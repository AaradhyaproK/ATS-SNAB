/**
 * Vercel / Vite API Function: LiveKit Room Token & Agent Dispatcher
 * Endpoint: POST /api/livekit-token or GET /api/livekit-token
 * 
 * Generates an AccessToken and explicitly dispatches the LiveKit voice interviewer to the room.
 */
import { AccessToken, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';

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

    const metadataPayload = JSON.stringify({
      jobId: body.jobId || '',
      jobTitle: body.jobTitle || 'Software Engineer',
      candidateName: participantName,
      candidateEmail: body.email || '',
      questions: Array.isArray(body.questions) ? body.questions : []
    });

    const httpUrl = livekitUrl.replace(/^ws(s?):\/\//, 'http$1://');

    // 1. Ensure Room exists with interview metadata
    try {
      const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      await roomService.createRoom({
        name: roomName,
        metadata: metadataPayload,
        emptyTimeout: 600,
        maxParticipants: 5
      });
      console.log(`[LiveKit Room]: Created/verified room ${roomName}`);
    } catch (e) {
      // Room might already exist
    }

    // 2. Explicitly dispatch LiveKit Voice AI Agent ('livekit-interviewer') to this room
    try {
      const agentClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
      await agentClient.createDispatch(roomName, 'livekit-interviewer', {
        metadata: metadataPayload
      });
      console.log(`[LiveKit Dispatch]: Dispatched 'livekit-interviewer' to room ${roomName}`);
    } catch (dispatchErr) {
      console.warn(`[LiveKit Dispatch Info]: ${dispatchErr.message || dispatchErr}`);
    }

    // 3. Create AccessToken for Candidate
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '2h',
      metadata: metadataPayload
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
