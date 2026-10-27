import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
import { RoomEvent } from '@livekit/rtc-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { type Meta, createInterviewer } from './agent.ts';

// LIVEKIT_URL/API_KEY/API_SECRET, plus AGENT_NAME for local dev
dotenv.config({ path: '.env.local' });

export default defineAgent({
  entry: async (ctx) => {
    const meta = JSON.parse(ctx.job.metadata || '{}') as Meta;
    if (!meta.sessionId) throw new Error('missing interview metadata');

    // LiveKit Inference (no extra keys): AssemblyAI Universal-3.6 Pro STT (handles Indian and other English accents),
    // Gemma 4 (agent.ts), Inworld TTS mini, and the audio turn detector deciding when the candidate has finished.
    const { job, candidate: c } = meta;
    // AssemblyAI caps keyterms at 100
    const keyterms = [...new Set([job.company, job.title, c.name, c.city, job.location, ...(meta.keyterms ?? [])].filter(Boolean).map((t) => t.slice(0, 50)))].slice(0, 100);
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: 'assemblyai/universal-3-6-pro',
        language: 'en',
        modelOptions: { keyterms_prompt: keyterms, voice_focus: 'far-field' }, // candidates are mostly on laptop mics
      }),
      tts: new inference.TTS({ model: 'inworld/inworld-tts-1.5-mini', voice: 'Ashley' }),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
        // Candidates pause to think mid-answer: the chat-tuned defaults (300 ms / 2.5 s) cut them into fragments
        endpointing: { minDelay: 600, maxDelay: 4000 },
        // Keeps talking through "mhm" / "right" instead of stopping at every backchannel
        interruption: { mode: 'adaptive' },
        preemptiveGeneration: { enabled: true, preemptiveTts: true },
      },
    });

    // The candidate's page keeps the transcript and saves it to Firestore when the call ends, so every committed
    // line goes to it as a reliable data packet. ponytail: the browser is trusted with the transcript; move saving
    // server-side (agent -> API with firebase-admin) if candidates tampering with it becomes a concern.
    const encoder = new TextEncoder();
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
      if (item.type !== 'message' || (item.role !== 'user' && item.role !== 'assistant') || !item.textContent) return;
      const line = { role: item.role === 'user' ? 'candidate' : 'agent', text: item.textContent };
      void ctx.room.localParticipant
        ?.publishData(encoder.encode(JSON.stringify(line)), { reliable: true, topic: 'transcript' })
        .catch((e) => console.error('publish transcript failed', e));
    });
    session.on(voice.AgentSessionEventTypes.Close, () => ctx.shutdown('interview over'));

    // Lets the last lines reach the page before the room (and the candidate's connection) closes
    const hangUp = async () => {
      await ctx.room.localParticipant?.publishData(encoder.encode('{"end":true}'), { reliable: true, topic: 'transcript' }).catch(() => {});
      await session.shutdown({ reason: 'interview over' });
    };
    await session.start({
      agent: createInterviewer(meta, hangUp),
      room: ctx.room,
      inputOptions: { deleteRoomOnClose: true },
    });
    await ctx.connect();
    await ctx.waitForParticipant();

    // Scripted, not generated: the first words play as soon as TTS is ready instead of waiting on the LLM.
    const first = c.name.split(' ')[0] || 'there';
    const minutes = Math.round(meta.seconds / 60);
    if (meta.questions[0]) {
      session.say(`Hi ${first}, I'm calling from ${job.company}. This is a quick ${minutes} minute chat about the ${job.title} role. Let's start. ${meta.questions[0]}`);
    } else {
      session.generateReply({ instructions: `Greet ${first} and say you're calling from ${job.company} about the ${job.title} role.` });
    }
    // A dropped connection doesn't end the session, so the agent is still here when they rejoin
    ctx.room.on(RoomEvent.ParticipantConnected, () => {
      session.generateReply({ instructions: 'The candidate just reconnected after their connection dropped. Welcome them back in a few words and repeat your last question.' });
    });

    // Time limit: a nudge 30 s before; at the limit let the current sentence finish, then cut regardless 10 s later
    const ms = Math.max(60, meta.seconds) * 1000;
    const nudge = setTimeout(() => {
      session.generateReply({ instructions: 'Time is almost up. Do not ask new questions. Briefly thank the candidate, then call end_interview.' });
    }, ms - 30_000);
    const end = setTimeout(() => void hangUp(), ms);
    const cut = setTimeout(() => session.shutdown({ drain: false, reason: 'time limit' }), ms + 10_000);
    ctx.addShutdownCallback(async () => (clearTimeout(nudge), clearTimeout(end), clearTimeout(cut)));
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // The app dispatches by name (LIVEKIT_AGENT_NAME); local dev uses its own name so it never takes production calls
    agentName: process.env.AGENT_NAME || 'livekit-interviewer',
  }),
);
