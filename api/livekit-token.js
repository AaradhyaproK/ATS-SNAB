/**
 * Vercel Serverless Function: LiveKit token for an AI voice interview
 * Endpoint: POST /api/livekit-token  { jobId, name, city }
 *
 * Reads the job and its voice questions from Firestore (server-side, so a candidate can't rewrite the agent's prompt),
 * then returns a candidate token whose room config dispatches the `livekit-interviewer` agent with them as metadata.
 */
import crypto from 'node:crypto';

const fromFirestore = (v) => {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestore);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFirestore(x)]));
  return undefined;
};

async function getDoc(path) {
  const project = process.env.VITE_FIREBASE_PROJECT_ID;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}?key=${process.env.VITE_FIREBASE_API_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${path}: ${res.status}`);
  return fromFirestore({ mapValue: await res.json() });
}

/** LiveKit access token: an HS256 JWT signed with the project secret (same claims as the server SDK, no dependency). */
function livekitToken(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: process.env.LIVEKIT_API_KEY, nbf: now, exp: now + 900, ...claims })}`;
  return `${body}.${crypto.createHmac('sha256', process.env.LIVEKIT_API_SECRET).update(body).digest('base64url')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
    return res.status(500).json({ error: 'LiveKit is not configured on the server.' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const jobId = String(body.jobId || '');
  const name = String(body.name || '').trim().slice(0, 80);
  const city = String(body.city || '').trim().slice(0, 80);
  if (!/^[\w-]{1,64}$/.test(jobId) || !name) return res.status(400).json({ error: 'jobId and name are required.' });

  try {
    const [job, voice] = await Promise.all([getDoc(`interviews/${jobId}`), getDoc(`voiceInterviews/${jobId}`)]);
    if (!job) return res.status(404).json({ error: 'This job no longer exists.' });
    if (job.isActive === false || /closed|inactive/i.test(job.status || '')) return res.status(410).json({ error: 'This job is no longer accepting interviews.' });
    const customQuestions = Array.isArray(body.questions)
      ? body.questions.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim().slice(0, 300)).slice(0, 15)
      : [];
    const resumeSummary = String(body.resumeSummary || body.resumeText || '').trim().slice(0, 2500);

    let questions = customQuestions.length > 0
      ? customQuestions
      : (voice?.questions || job?.questions || []).map((q) => (typeof q === 'string' ? q : q?.question)).filter(Boolean).slice(0, 15);

    if (!questions.length) {
      questions = [
        `Please introduce yourself and tell me about your background relevant to the ${job.title || 'role'}.`,
        `What practical experience do you have with the key skills required for this position?`,
        `Can you describe a key project you worked on and the main challenges you solved?`,
        `Why are you interested in this position at ${job.companyName || job.company || 'our company'}?`,
        `Do you have any questions for us regarding the role or the team?`
      ];
    }

    // ~1.5 min per question, 5 to 15 minutes
    const seconds = Math.min(900, Math.max(300, questions.length * 90));
    const sessionId = `vresp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const metadata = JSON.stringify({
      sessionId,
      seconds,
      job: {
        title: job.title || 'the open',
        company: job.companyName || job.company || 'our company',
        description: String(job.description || '').slice(0, 2000),
        location: job.location || job.city || '',
      },
      candidate: { name, city, resumeSummary },
      questions,
      keyterms: String(job.skills || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 60),
    });
    const token = livekitToken({
      sub: sessionId,
      name,
      video: { room: sessionId, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
      roomConfig: { agents: [{ agentName: process.env.LIVEKIT_AGENT_NAME || 'livekit-interviewer', metadata }] },
    });
    return res.status(200).json({ url: process.env.LIVEKIT_URL, token, sessionId, seconds, questions });
  } catch (err) {
    console.error('[livekit-token]', err);
    return res.status(500).json({ error: 'Could not start the interview. Please try again.' });
  }
}
