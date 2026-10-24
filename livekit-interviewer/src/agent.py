from __future__ import annotations

import asyncio
import json
import logging
import textwrap
import time

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    STTContextOptions,
    TurnHandlingOptions,
    UserInputTranscribedEvent,
    cli,
    inference,
    llm,
    room_io,
)
from livekit.plugins import ai_coustics

logger = logging.getLogger("livekit-interviewer")
logging.basicConfig(level=logging.INFO)

load_dotenv(".env.local")

# Common English filler words to track during speech analysis
FILLER_WORDS = {
    "um", "uh", "like", "you know", "basically", "actually", 
    "sort of", "kind of", "i mean", "right", "so yeah", "honestly"
}


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
            You are "Alex", an elite, empathetic, and sharp Principal Technical Interviewer conducting a live AI Video Screening Interview.

            # CANDIDATE & ROLE CONTEXT:
            - Candidate Name: {self.candidate_name}
            - Job Role: {self.job_title}
            - Total Planned Core Questions: {len(self.questions)}

            # CORE PLANNED QUESTIONS:
{questions_formatted}

            # YOUR INTERVIEW WORKFLOW & BEHAVIOR:
            1. WARM INTRODUCTION (TURN 1):
               - Start by greeting {self.candidate_name} warmly with a natural, encouraging voice.
               - Let them know you're excited for today's technical session.
               - Move straight to Question 1: call `record_question(question_index=0, question_text="{self.questions[0]}")` and speak Question 1 aloud clearly.

            2. COMPLIMENTS & ENCOURAGEMENT (DYNAMIC REINFORCEMENT):
               - When {self.candidate_name} explains a thoughtful architecture, provides concrete metrics, or demonstrates strong problem-solving, offer genuine, brief praise.
               - Examples: "Spot on!", "That's a very clean architectural solution.", "I really like that proactive incident mindset.", "Great depth on the caching trade-offs."
               - ALWAYS call `record_compliment(compliment="...")` whenever you share encouraging feedback so the candidate's screen highlights your compliment.

            3. ACTIVE LISTENING & REAL-TIME DYNAMIC CROSS-QUESTIONING (CRITICAL):
               - After {self.candidate_name} answers each core question, DO NOT immediately jump to the next planned question.
               - Proactively evaluate their answer and ask AT MOST ONE sharp, targeted cross-question:
                 * Probe into architectural trade-offs, scalability bottlenecks, or failure scenarios (e.g. "What happens if your primary database replicates with high lag during peak traffic?").
                 * If their answer was high-level or theoretical, ask for concrete production metrics, tech stack choices, or retrospective lessons.
               - Call `record_cross_question(question_text="...")` when asking this follow-up question.

            4. REPEAT QUESTIONS ON REQUEST:
               - If {self.candidate_name} asks to repeat the question, says they didn't hear, or asks for clarification, warmly and clearly repeat or rephrase the question.
               - Call `repeat_question(question_text="...")`.

            5. QUESTION ADVANCEMENT:
               - After the candidate answers the cross-question (or if their initial answer was extraordinarily comprehensive and complete), transition smoothly to the next core question.
               - Call `record_question(question_index=..., question_text=...)` with the corresponding index (0-based) and text.

            6. AUTO-END & CONCLUDING DEBRIEF:
               - Once all planned core questions have been asked and answered, deliver a warm closing statement thanking {self.candidate_name} for their time, clarity, and insights.
               - Let them know their interview is officially complete and their evaluation report is being prepared for the hiring team.
               - IMMEDIATELY call `complete_interview(summary="...")` with a concise, professional 2-3 sentence technical evaluation summary of their performance.

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

    # Real-time Speech Analysis Metrics Tracker
    stats = {
        "candidate_words": 0,
        "filler_words_count": 0,
        "cross_questions_count": 0,
        "compliments_count": 0,
        "questions_completed": 0,
        "start_time": time.time(),
    }

    # Helper function to publish real-time events to the frontend via Data Channel
    async def publish_event(event_data: dict):
        try:
            payload = json.dumps(event_data)
            await ctx.room.local_participant.publish_data(payload, reliable=True)
            logger.info(f"Published LiveKit room event: {event_data.get('type')}")
        except Exception as err:
            logger.error(f"Error publishing LiveKit room event: {err}")

    # Function Tools for Alex to communicate interview state changes
    @llm.function_tool(
        description="Call this whenever you start asking one of the planned core interview questions so the candidate screen updates with the question text and progress bar."
    )
    async def record_question(question_index: int, question_text: str) -> str:
        stats["questions_completed"] = max(stats["questions_completed"], question_index + 1)
        await publish_event({
            "type": "core_question",
            "index": question_index,
            "text": question_text,
            "metrics": {
                "candidate_words": stats["candidate_words"],
                "filler_words": stats["filler_words_count"],
                "cross_questions": stats["cross_questions_count"],
                "compliments": stats["compliments_count"],
            }
        })
        return f"Core question #{question_index + 1} broadcasted."

    @llm.function_tool(
        description="Call this when asking a dynamic follow-up or probing cross-question based on the candidate's previous response."
    )
    async def record_cross_question(question_text: str) -> str:
        stats["cross_questions_count"] += 1
        await publish_event({
            "type": "cross_question",
            "text": question_text,
            "metrics": {
                "candidate_words": stats["candidate_words"],
                "filler_words": stats["filler_words_count"],
                "cross_questions": stats["cross_questions_count"],
                "compliments": stats["compliments_count"],
            }
        })
        return "Cross-question broadcasted."

    @llm.function_tool(
        description="Call this when complimenting or giving encouraging feedback to the candidate on a great response."
    )
    async def record_compliment(compliment: str) -> str:
        stats["compliments_count"] += 1
        await publish_event({
            "type": "compliment",
            "text": compliment,
            "metrics": {
                "candidate_words": stats["candidate_words"],
                "filler_words": stats["filler_words_count"],
                "cross_questions": stats["cross_questions_count"],
                "compliments": stats["compliments_count"],
            }
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
        duration_sec = round(time.time() - stats["start_time"], 1)
        final_metrics = {
            "candidate_words": stats["candidate_words"],
            "filler_words": stats["filler_words_count"],
            "cross_questions_count": stats["cross_questions_count"],
            "compliments_count": stats["compliments_count"],
            "questions_completed": stats["questions_completed"],
            "total_questions": len(questions) if questions else 4,
            "duration_seconds": duration_sec,
            "fluency_score": max(50, 100 - min(50, stats["filler_words_count"] * 3)),
        }
        await publish_event({
            "type": "interview_completed",
            "summary": summary,
            "metrics": final_metrics,
        })
        return "Interview auto-submission event broadcasted."

    tools = [record_question, record_cross_question, record_compliment, repeat_question, complete_interview]

    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-3-6-pro", language="en"),
        stt_context_options=STTContextOptions(
            keyterms=["HireX", "InterviewXpert", candidate_name, job_title, "Kubernetes", "PostgreSQL", "Docker", "Microservices", "CI/CD", "Redis", "Kafka", "AWS", "GCP"],
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

    # Attach Real-time Speech Transcription & Analysis Listeners
    @session.on("user_input_transcribed")
    def on_user_input_transcribed(ev: UserInputTranscribedEvent):
        transcript_text = (ev.transcript or "").strip()
        if not transcript_text:
            return

        # Perform live speech analysis on transcribed tokens
        words = transcript_text.lower().split()
        if ev.is_final:
            stats["candidate_words"] += len(words)
            for w in words:
                if w in FILLER_WORDS:
                    stats["filler_words_count"] += 1

        duration_sec = max(1.0, time.time() - stats["start_time"])
        current_words = stats["candidate_words"] + (0 if ev.is_final else len(words))
        wpm = round((current_words / duration_sec) * 60)

        # Broadcast live transcript stream to frontend
        asyncio.create_task(publish_event({
            "type": "transcript",
            "speaker": "candidate",
            "text": transcript_text,
            "is_final": ev.is_final,
            "metrics": {
                "candidate_words": current_words,
                "filler_words": stats["filler_words_count"],
                "speaking_pace_wpm": wpm,
                "cross_questions": stats["cross_questions_count"],
                "compliments": stats["compliments_count"],
            }
        }))

    @session.on("conversation_item_added")
    def on_conversation_item_added(ev: ConversationItemAddedEvent):
        try:
            item = ev.item
            if hasattr(item, "role") and hasattr(item, "content"):
                if item.role == "assistant":
                    content_str = str(item.content)
                    asyncio.create_task(publish_event({
                        "type": "transcript",
                        "speaker": "ai",
                        "text": content_str,
                        "is_final": True,
                    }))
        except Exception as err:
            logger.warning(f"Error publishing conversation item transcript: {err}")

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

    # Join the room and announce presence
    await ctx.connect()
    logger.info(f"AI Interviewer joined room {ctx.room.name} and is listening.")

    # Broadcast Question 1 immediately so candidate screen renders it
    first_q = questions[0] if questions else "Tell me about your background and the most impactful project you've worked on recently."
    await record_question(0, first_q)

    # Greet candidate proactively and introduce Question 1
    greeting_prompt = (
        f"Warmly greet {candidate_name}, introduce yourself as Alex, your AI technical interviewer for the {job_title} role. "
        f"Ask Question 1 clearly aloud: '{first_q}'."
    )
    session.generate_reply(instructions=greeting_prompt)


if __name__ == "__main__":
    cli.run_app(server)
