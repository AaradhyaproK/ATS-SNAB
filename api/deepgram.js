/**
 * Vercel Serverless Function: Secure Deepgram Proxy
 * Endpoint: /api/deepgram
 * 
 * Actions:
 * - POST /api/deepgram?action=speak (TTS): Synthesizes text to speech using Deepgram Aura on server
 * - POST /api/deepgram?action=transcribe (STT): Transcribes audio blob using Deepgram Nova-3 on server
 * - GET /api/deepgram?action=token: Provides authorization token for streaming
 * 
 * Runs strictly on backend (Node.js runtime).
 * Secret API key (DEEPGRAM_API_KEY) is NEVER shipped to or exposed in the client browser bundle.
 */

export default async function handler(req, res) {
  // CORS Headers
  const origin = req.headers?.origin || req.headers?.Origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = (
    process.env.DEEPGRAM_API_KEY ||
    process.env.VITE_DEEPGRAM_API_KEY ||
    ''
  ).replace(/['"]/g, '').trim();

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'DEEPGRAM_API_KEY is not configured on the server. Please add DEEPGRAM_API_KEY to environment variables.'
    });
  }

  const action = req.query?.action || (req.body && req.body.action) || 'speak';

  // 1. Text-To-Speech (Deepgram Aura)
  if (action === 'speak') {
    try {
      const { text, voice = 'aura-asteria-en' } = req.body || {};
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: 'Text parameter is required for TTS.' });
      }

      const dgUrl = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`;
      const dgRes = await fetch(dgUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (!dgRes.ok) {
        const errText = await dgRes.text().catch(() => '');
        console.error('[Deepgram Server Proxy TTS Error]:', dgRes.status, errText);
        return res.status(dgRes.status).json({ success: false, error: `Deepgram TTS error: ${dgRes.status} ${errText}` });
      }

      const audioBuffer = await dgRes.arrayBuffer();
      res.setHeader('Content-Type', dgRes.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      return res.status(200).send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error('[Deepgram Server Proxy TTS Exception]:', err);
      return res.status(500).json({ success: false, error: err.message || 'TTS synthesis failed' });
    }
  }

  // 2. Pre-recorded Audio Transcription (Deepgram Nova-3 REST)
  if (action === 'transcribe') {
    try {
      let audioBuffer;
      let contentType = req.headers['content-type'] || 'audio/webm';

      if (Buffer.isBuffer(req.body)) {
        audioBuffer = req.body;
      } else if (req.body?.audioBase64) {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
        if (req.body.contentType) contentType = req.body.contentType;
      } else if (typeof req.body === 'string') {
        audioBuffer = Buffer.from(req.body);
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Audio payload is required for transcription.' });
      }

      const queryParams = new URLSearchParams({
        model: 'nova-3',
        smart_format: 'true',
        punctuate: 'true',
        paragraphs: 'true',
        numerals: 'true',
        diarize: 'true',
        sentiment: 'true',
        filler_words: 'true',
        detect_language: 'true'
      });

      const dgUrl = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;
      const dgRes = await fetch(dgUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': contentType
        },
        body: audioBuffer
      });

      if (!dgRes.ok) {
        const errText = await dgRes.text().catch(() => '');
        console.error('[Deepgram Server Proxy Transcribe Error]:', dgRes.status, errText);
        return res.status(dgRes.status).json({ success: false, error: `Deepgram STT error: ${dgRes.status} ${errText}` });
      }

      const data = await dgRes.json();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('[Deepgram Server Proxy Transcribe Exception]:', err);
      return res.status(500).json({ success: false, error: err.message || 'Transcription failed' });
    }
  }

  // 3. Status/Capabilities Endpoint for Streaming WebSocket (Zero Secret Key Leakage)
  if (action === 'token') {
    return res.status(200).json({
      success: true,
      useProxy: true,
      endpoint: '/deepgram-ws'
    });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
}
