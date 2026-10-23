from __future__ import annotations

import json
import logging
import textwrap

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    STTContextOptions,
    TurnHandlingOptions,
    cli,
    inference,
    llm,
    room_io,
)
from livekit.plugins import ai_coustics

logger = logging.getLogger("livekit-interviewer")

load_dotenv(".env.local")


class AIInterviewer(Agent):
    def __init__(
        self,
        candidate_name: str = "Candidate",
        job_title: str = "Software Engineer",
        questions: list[str] | None = None,
        tools: list[llm.Tool] | None = None,
    ) -> None:
        self.candidate_name = candidate_name
        self.job_title = job_title
        self.questions = questions or [
            "Tell me about your background and the most impactful project you've worked on recently.",
            "How do you approach architecting scalable, resilient systems under high load?",
            "Can you describe a tough technical bug or outage you encountered and how you resolved it?",
            "How do you handle disagreements on technical design with peers or stakeholders?"
        ]

        questions_formatted = "\n".join([f"  {idx + 1}. {q}" for idx, q in enumerate(self.questions)])

        instructions = textwrap.dedent(
            f"""\
            You are "Alex", an elite, empathetic, and sharp Senior Technical Interviewer conducting a live AI Video Screening Interview.

            # SESSION CONTEXT:
            - Candidate Name: {self.candidate_name}
            - Job Role: {self.job_title}
            - Total Planned Questions: {len(self.questions)}

            # CORE PLANNED QUESTIONS:
{questions_formatted}

            # YOUR INTERVIEW WORKFLOW & BEHAVIOR:
            1. WARM INTRODUCTION:
               - Start by greeting {self.candidate_name} warmly with a natural, encouraging voice.
               - Confirm they can hear you clearly and make them feel confident.
               - Move straight to Question 1: call `record_question(question_index=0, question_text="{self.questions[0]}")` and speak Question 1 aloud.

            2. COMPLIMENTS & ENCOURAGEMENT:
               - When {self.candidate_name} explains a thoughtful architecture, provides concrete metrics, or demonstrates strong problem-solving, offer genuine, brief praise (e.g. "Spot on!", "That's a very clean architectural solution.", "I really like that proactive mindset.").
               - Call `record_compliment(compliment="...")` whenever you share encouraging feedback.

            3. ACTIVE LISTENING & REAL-TIME DYNAMIC CROSS-QUESTIONING (CRITICAL):
               - After {self.candidate_name} answers each core question, DO NOT immediately jump to the next planned question.
               - Proactively evaluate their answer and ask AT MOST ONE sharp, targeted cross-question:
                 * Probe into architectural trade-offs, scalability, or failure scenarios (e.g. "What happens if your cache layer fails under peak traffic?").
                 * If their answer was high-level, ask for concrete metrics or production experiences.
               - Call `record_cross_question(question_text="...")` when asking this follow-up question.

            4. REPEAT QUESTIONS ON REQUEST:
               - If {self.candidate_name} asks to repeat the question, says they didn't hear, or asks for clarification, warmly and clearly repeat or rephrase the question.
               - Call `repeat_question(question_text="...")`.

            5. QUESTION ADVANCEMENT:
               - After the candidate answers the cross-question (or if their initial answer was extraordinarily comprehensive), transition smoothly to the next core question.
               - Call `record_question(question_index=..., question_text=...)` with the corresponding index (0-based) and text.

            6. WRAP-UP & AUTOMATIC SUBMISSION:
               - Once all planned questions have been asked and answered, deliver a warm closing statement thanking {self.candidate_name} for their time and insights.
               - Let them know that their interview is complete and their evaluation report is being prepared for the hiring team.
               - IMMEDIATELY call `complete_interview(summary="...")` with a concise 2-sentence summary of their technical performance.

            # SPOKEN VOICE DELIVERY RULES (STRICT):
            - You are speaking aloud through a text-to-speech engine.
            - NEVER speak markdown, asterisks, bullet points, JSON, emojis, or code blocks.
            - Keep your responses punchy and conversational (1 to 3 spoken sentences maximum per turn).
            - Let {self.candidate_name} do 80% of the talking.
            """
        )

        super().__init__(
            llm=inference.LLM(model="google/gemma-4-31b-it"),
            instructions=instructions,
            tools=tools or [],
        )


server = AgentServer()


@server.rtc_session(agent_name="livekit-interviewer")
async def interview_session(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }
    logger.info(f"Connecting AI Interviewer to room: {ctx.room.name}")

    # Extract metadata passed from ATS token if available
    candidate_name = "Candidate"
    job_title = "Candidate Position"
    questions = []

    try:
        if ctx.room.metadata:
            meta = json.loads(ctx.room.metadata)
            candidate_name = meta.get("candidateName") or candidate_name
            job_title = meta.get("jobTitle") or job_title
            if meta.get("questions") and isinstance(meta.get("questions"), list) and len(meta.get("questions")) > 0:
                questions = meta.get("questions")
    except Exception as e:
        logger.warning(f"Could not parse room metadata: {e}")

    # Helper function to publish real-time events to the frontend via Data Channel
    async def publish_event(event_data: dict):
        try:
            payload = json.dumps(event_data)
            await ctx.room.local_participant.publish_data(payload, reliable=True)
            logger.info(f"Published LiveKit room event: {event_data.get('type')}")
        except Exception as err:
            logger.error(f"Error publishing LiveKit room event: {err}")

    # Define Function Tools for Alex to communicate interview state changes
    @llm.function_tool(
        description="Call this whenever you start asking one of the planned core interview questions so the candidate screen updates with the question text and progress bar."
    )
    async def record_question(question_index: int, question_text: str) -> str:
        await publish_event({
            "type": "core_question",
            "index": question_index,
            "text": question_text,
        })
        return f"Core question #{question_index + 1} broadcasted."

    @llm.function_tool(
        description="Call this when asking a dynamic follow-up or probing cross-question based on the candidate's previous response."
    )
    async def record_cross_question(question_text: str) -> str:
        await publish_event({
            "type": "cross_question",
            "text": question_text,
        })
        return "Cross-question broadcasted."

    @llm.function_tool(
        description="Call this when complimenting or giving encouraging feedback to the candidate on a great response."
    )
    async def record_compliment(compliment: str) -> str:
        await publish_event({
            "type": "compliment",
            "text": compliment,
        })
        return "Compliment broadcasted."

    @llm.function_tool(
        description="Call this when repeating or clarifying a question if the candidate asks to repeat it."
    )
    async def repeat_question(question_text: str) -> str:
        await publish_event({
            "type": "repeat_question",
            "text": question_text,
        })
        return "Question repeat broadcasted."

    @llm.function_tool(
        description="Call this strictly after all interview questions have been asked, answered, and wrapped up. This triggers automatic submission of the candidate interview."
    )
    async def complete_interview(summary: str) -> str:
        await publish_event({
            "type": "interview_completed",
            "summary": summary,
        })
        return "Interview auto-submission event broadcasted."

    tools = [record_question, record_cross_question, record_compliment, repeat_question, complete_interview]

    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-3-6-pro", language="en"),
        stt_context_options=STTContextOptions(
            keyterms=["HireX", "InterviewXpert", candidate_name, job_title],
            keyterm_detection={"enabled": True},
        ),
        tts=inference.TTS(
            model="fishaudio/s2.1-pro", voice="fa4c9eb3dccc4806b382b40d61c6b10a"
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
            interruption={"mode": "adaptive"},
            preemptive_generation={"enabled": True},
        ),
        expressive=True,
    )

    interviewer_agent = AIInterviewer(
        candidate_name=candidate_name,
        job_title=job_title,
        questions=questions if questions else None,
        tools=tools,
    )

    await session.start(
        agent=interviewer_agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )

    # Join the room and greet the candidate
    await ctx.connect()
    logger.info(f"AI Interviewer joined room {ctx.room.name} and is listening.")


if __name__ == "__main__":
    cli.run_app(server)
