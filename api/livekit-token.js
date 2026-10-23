/**
 * Vercel Serverless Function: LiveKit Room Token Issuer
 * Endpoint: POST /api/livekit-token or GET /api/livekit-token
 * 
 * Generates an AccessToken for candidate connection to LiveKit Cloud WebRTC room.
 */
import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = (
      process.env.LIVEKIT_API_KEY ||
      'APIv3FhP7v3MrFg'
    ).trim();

    const apiSecret = (
      process.env.LIVEKIT_API_SECRET ||
      'S1Jadtc9dEmLOv9b8i1ze3UJFEpJR9KE2eLvyNyFPO2'
    ).trim();

    const livekitUrl = (
      process.env.LIVEKIT_URL ||
      process.env.VITE_LIVEKIT_URL ||
      'wss://interviewxpert-gps6wbjs.livekit.cloud'
    ).trim();

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit API key or secret not configured.'
      });
    }

    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : req.query || {};

    const roomName = (body.roomName || body.room || `interview-${body.jobId || 'demo'}-${Date.now().toString().slice(-4)}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const participantName = body.participantName || body.name || 'Candidate';
    const participantIdentity = (body.identity || body.email || `candidate-${Date.now().toString().slice(-4)}`).replace(/[^a-zA-Z0-9_@-]/g, '_');

    // Create AccessToken
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '2h',
      metadata: JSON.stringify({
        jobId: body.jobId || '',
        jobTitle: body.jobTitle || 'Software Engineer',
        candidateName: participantName,
        candidateEmail: body.email || '',
        questions: Array.isArray(body.questions) ? body.questions : []
      })
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = await at.toJwt();

    return res.status(200).json({
      success: true,
      token,
      url: livekitUrl,
      roomName,
      participantIdentity,
      participantName
    });
  } catch (error) {
    console.error('[LiveKit Token Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create LiveKit token'
    });
  }
}
