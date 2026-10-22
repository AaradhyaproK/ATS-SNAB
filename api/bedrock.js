import OpenAI from 'openai';

/**
 * Vercel Serverless Function: Secure Bedrock Mantle / Anthropic AI Proxy
 *
 * Runs strictly on backend (Node.js runtime).
 * Secret API key (ANTHROPIC_API_KEY) is NEVER shipped to or exposed in the client browser bundle.
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const {
      systemInstruction = '',
      userPrompt = '',
      history,
      temperature = 0.2,
      responseJson = false,
      maxTokens = 4096,
      model,
    } = req.body || {};

    const apiKey = (
      process.env.ANTHROPIC_API_KEY ||
      process.env.BEDROCK_API_KEY ||
      process.env.VITE_ANTHROPIC_API_KEY ||
      ''
    ).replace(/['"]/g, '').trim();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Bedrock / Anthropic API key is not configured on the server. Please set ANTHROPIC_API_KEY in environment variables.',
      });
    }

    const baseURL = (
      process.env.BEDROCK_CHAT_BASE_URL ||
      process.env.VITE_BEDROCK_CHAT_BASE_URL ||
      'https://bedrock-mantle.ap-south-1.api.aws/v1'
    ).replace(/['"]/g, '').trim().replace(/\/$/, '');

    const resolvedModel = (
      model ||
      process.env.BEDROCK_MODEL_DEFAULT ||
      process.env.VITE_BEDROCK_MODEL_DEFAULT ||
      'zai.glm-4.7-flash'
    ).replace(/['"]/g, '').trim();

    const workspaceId = (
      process.env.ANTHROPIC_WORKSPACE_ID ||
      process.env.VITE_ANTHROPIC_WORKSPACE_ID ||
      'default'
    ).replace(/['"]/g, '').trim();

    const client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        'OpenAI-Project': workspaceId,
      },
    });

    const messages = [];

    const system = responseJson
      ? `${systemInstruction}\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no commentary.`
      : systemInstruction;

    if (system) {
      messages.push({ role: 'system', content: system });
    }

    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        messages.push({ role: turn.role, content: turn.content });
      }
    } else if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    } else {
      return res.status(400).json({ success: false, error: 'Either userPrompt or history is required.' });
    }

    const createCompletion = async (withJsonFormat) =>
      client.chat.completions.create({
        model: resolvedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(withJsonFormat && responseJson
          ? { response_format: { type: 'json_object' } }
          : {}),
      });

    let completion;
    try {
      completion = await createCompletion(true);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (responseJson && /response_format|json_object|invalid/i.test(msg)) {
        completion = await createCompletion(false);
      } else {
        throw err;
      }
    }

    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      return res.status(502).json({
        success: false,
        error: `Empty response returned by Bedrock model ${resolvedModel}.`,
      });
    }

    return res.status(200).json({ success: true, text });
  } catch (error) {
    console.error('[Bedrock Serverless Proxy Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error occurred while calling Bedrock AI.',
    });
  }
}
