# livekit-interviewer

LiveKit Agents (Node) voice interviewer for SNAB hireX voice-interview jobs. Ported from the Hire Excellence `interview-agent`.

Flow: the candidate page (`pages/LiveVoiceInterview.tsx`) calls `/api/livekit-token`, which reads the job from Firestore
and returns a token whose room config dispatches this agent with the job, candidate and questions as job metadata.
The agent runs the call (time limit from the metadata), streams each transcript line to the page on the `transcript`
data topic, and closes the room when done. The page then grades the transcript with Bedrock and saves it to
`voiceInterviewResponses`.

Models (LiveKit Inference, no extra keys): AssemblyAI Universal-3.6 Pro STT, Gemma 4 31B, Inworld TTS 1.5 Mini, LiveKit turn detector.

## Run locally

```bash
pnpm install
node src/main.ts dev
```

`.env.local` needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (same project as the app) and
`AGENT_NAME=livekit-interviewer-dev`. Set the app's `LIVEKIT_AGENT_NAME` to the same value so local calls reach the local agent.

## Deploy to LiveKit Cloud

```bash
lk agent deploy   # uses livekit.toml (project interviewxpert)
lk agent logs
```

Production registers as `livekit-interviewer` (no `AGENT_NAME` set).
