import OpenAI from 'openai';

/**
 * Amazon Bedrock Mantle (ap-south-1) — Chat Completions API + API key auth.
 *
 * MiniMax M2.1 / M2.5 and GLM 4.7 Flash do NOT support Anthropic Messages
 * (`/anthropic/v1/messages`). AWS docs require Chat Completions on:
 *   https://bedrock-mantle.{region}.api.aws/v1
 *
 * Auth still uses the Bedrock Mantle API key (ABSK… / ANTHROPIC_API_KEY).
 *
 * Model routing:
 * - Interview question generation → MiniMax M2.1
 * - Interview report / feedback   → MiniMax M2.5
 * - All other AI workloads        → GLM 4.7 Flash
 */

export type BedrockModelPurpose = 'questions' | 'report' | 'default';

export const BEDROCK_MODELS = {
  questions: import.meta.env.VITE_BEDROCK_MODEL_DEFAULT || 'zai.glm-4.7-flash',
  report: import.meta.env.VITE_BEDROCK_MODEL_DEFAULT || 'zai.glm-4.7-flash',
  default: import.meta.env.VITE_BEDROCK_MODEL_DEFAULT || 'zai.glm-4.7-flash',
} as const;

const sanitize = (value?: string) => (value || '').replace(/['"]/g, '').trim();

export const getBedrockApiKey = (): string => {
  return sanitize(import.meta.env.VITE_ANTHROPIC_API_KEY || (import.meta.env as any).VITE_BEDROCK_API_KEY || '');
};

/** Anthropic Messages base (kept for config parity with AWS/Anthropic samples). */
export const getBedrockAnthropicBaseUrl = (): string =>
  sanitize(import.meta.env.VITE_ANTHROPIC_BASE_URL) ||
  'https://bedrock-mantle.ap-south-1.api.aws/anthropic';

/**
 * Chat Completions base for MiniMax / GLM on Mantle.
 * Derived from Anthropic base by swapping `/anthropic` → `/v1`.
 */
export const getBedrockChatBaseUrl = (): string => {
  const explicit = sanitize(import.meta.env.VITE_BEDROCK_CHAT_BASE_URL);
  if (explicit) return explicit.replace(/\/$/, '');

  const anthropicBase = getBedrockAnthropicBaseUrl().replace(/\/$/, '');
  if (anthropicBase.endsWith('/anthropic')) {
    return `${anthropicBase.slice(0, -'/anthropic'.length)}/v1`;
  }
  return 'https://bedrock-mantle.ap-south-1.api.aws/v1';
};

export const getBedrockWorkspaceId = (): string =>
  sanitize(import.meta.env.VITE_ANTHROPIC_WORKSPACE_ID) || 'default';

export const resolveBedrockModel = (purpose: BedrockModelPurpose = 'default'): string =>
  BEDROCK_MODELS[purpose] || BEDROCK_MODELS.default;

let clientInstance: OpenAI | null = null;

export const getBedrockClient = (): OpenAI => {
  if (!clientInstance) {
    const key = getBedrockApiKey();
    clientInstance = new OpenAI({
      apiKey: key || 'dummy_key',
      baseURL: getBedrockChatBaseUrl(),
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        'OpenAI-Project': getBedrockWorkspaceId(),
      },
    });
  }
  return clientInstance;
};

export const stripMarkdownJson = (text: string): string => {
  if (!text) return '';
  return text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
};

/**
 * Robust JSON parser for LLM responses.
 * Automatically recovers from markdown wrapping, control chars, and truncated token cutoffs.
 */
export function safeParseJson<T>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty or invalid response received from AI model.');
  }

  // 1. Direct parse after stripping markdown fences
  const cleaned = stripMarkdownJson(rawText);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to repair strategies
  }

  // 2. Extract outermost JSON structure: { ... } or [ ... ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let isArray = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isArray = false;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isArray = true;
  }

  if (startIdx !== -1) {
    const endChar = isArray ? ']' : '}';
    const lastEnd = cleaned.lastIndexOf(endChar);
    if (lastEnd > startIdx) {
      const candidate = cleaned.slice(startIdx, lastEnd + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Proceed to repair
      }
    }
  }

  // 3. Automatic repair for truncated JSON (e.g. token cutoff mid-string or mid-object)
  // Strategy: Find the last valid closed item boundary '}' and close the parent array and object
  try {
    const targetSubstring = startIdx !== -1 ? cleaned.slice(startIdx) : cleaned;
    const lastClosingBrace = targetSubstring.lastIndexOf('}');
    if (lastClosingBrace !== -1) {
      let candidate = targetSubstring.slice(0, lastClosingBrace + 1).trim();

      // If candidate was inside an array like "questions": [ {...}, ...
      if (candidate.includes('[') && !candidate.endsWith(']')) {
        candidate += '\n]}';
      } else if (!candidate.endsWith('}')) {
        candidate += '\n}';
      }

      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Try with just closing array ']'
        try {
          return JSON.parse(targetSubstring.slice(0, lastClosingBrace + 1) + ']') as T;
        } catch {
          // Proceed to next fallback
        }
      }
    }
  } catch {
    // Continue
  }

  // 4. Sanitize unescaped control characters inside JSON strings (e.g. raw tabs or newlines)
  try {
    const sanitized = cleaned
      .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\r\n/g, '\n');
    return JSON.parse(sanitized) as T;
  } catch {
    // Continue
  }

  // 5. Final fallback: extract individual questions or items via regex
  try {
    const questionBlocks = cleaned.match(/\{[^{}]*"question"\s*:\s*"[^"]+"[^{}]*\}/g);
    if (questionBlocks && questionBlocks.length > 0) {
      const items: any[] = [];
      for (const block of questionBlocks) {
        try {
          items.push(JSON.parse(block));
        } catch {
          // skip
        }
      }
      if (items.length > 0) {
        return { questions: items } as unknown as T;
      }
    }
  } catch {
    // Continue
  }

  throw new Error('AI response was incomplete. Please try generating with fewer questions or a more specific topic.');
}

export interface BedrockCallOptions {
  purpose?: BedrockModelPurpose;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseJson?: boolean;
}

/**
 * Core text completion via Chat Completions on Bedrock Mantle.
 * Routes through secure /api/bedrock backend endpoint (Zero secrets leaked to browser).
 */
export async function callBedrockApi(
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.2,
  responseJson = false,
  purpose: BedrockModelPurpose = 'default',
  maxTokens = 4096,
  modelOverride?: string
): Promise<string> {
  const model = modelOverride || resolveBedrockModel(purpose);

  // 1. Primary: Secure Serverless Backend Proxy (Node.js runtime, zero keys in browser)
  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/bedrock` : '/api/bedrock';

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        userPrompt,
        temperature,
        responseJson,
        purpose,
        maxTokens,
        model,
      }),
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.success && data?.text) {
        return data.text.trim();
      }
      if (data?.error) {
        throw new Error(data.error);
      }
    } else {
      const errData = await resp.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (backendErr: any) {
    if (backendErr.message && !backendErr.message.includes('fetch') && !backendErr.message.includes('Failed to fetch')) {
      throw backendErr;
    }
    console.warn('[BedrockService] Backend serverless endpoint not reachable, checking fallback...', backendErr);
  }

  // 2. Direct client fallback (only if client key is configured in dev)
  const clientKey = getBedrockApiKey();
  if (clientKey) {
    const client = getBedrockClient();
    const system = responseJson
      ? `${systemInstruction}\n\nIMPORTANT: Respond with valid JSON only. No markdown fences, no commentary.`
      : systemInstruction;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: userPrompt });

    const create = async (withJsonFormat: boolean) =>
      client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(withJsonFormat && responseJson
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      });

    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await create(true);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (responseJson && /response_format|json_object|invalid/i.test(msg)) {
        response = await create(false);
      } else {
        throw err;
      }
    }

    const text = response.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      throw new Error(`No text content returned from Bedrock model ${model}.`);
    }
    return text;
  }

  throw new Error('AI Service unavailable. Ensure ANTHROPIC_API_KEY is configured on your server.');
}

/**
 * Multi-turn chat (CareerHub, etc.).
 * Routes through secure /api/bedrock backend endpoint.
 */
export async function callBedrockChat(
  systemInstruction: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  temperature = 0.7,
  purpose: BedrockModelPurpose = 'default',
  maxTokens = 4096
): Promise<string> {
  const model = resolveBedrockModel(purpose);

  // 1. Primary: Secure Serverless Backend Proxy
  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/bedrock` : '/api/bedrock';

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        history,
        temperature,
        purpose,
        maxTokens,
        model,
      }),
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.success && data?.text) {
        return data.text.trim();
      }
      if (data?.error) {
        throw new Error(data.error);
      }
    } else {
      const errData = await resp.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (backendErr: any) {
    if (backendErr.message && !backendErr.message.includes('fetch') && !backendErr.message.includes('Failed to fetch')) {
      throw backendErr;
    }
  }

  // 2. Direct client fallback
  const clientKey = getBedrockApiKey();
  if (clientKey) {
    const client = getBedrockClient();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const text = response.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      throw new Error(`No text content returned from Bedrock chat model ${model}.`);
    }
    return text;
  }

  throw new Error('AI Chat unavailable. Ensure ANTHROPIC_API_KEY is configured on your server.');
}

export async function bedrockGenerateJson<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2,
  purpose: BedrockModelPurpose = 'default',
  maxTokens = 4096,
  modelOverride?: string
): Promise<T> {
  const text = await callBedrockApi(
    systemPrompt,
    userPrompt,
    temperature,
    true,
    purpose,
    maxTokens,
    modelOverride
  );
  return safeParseJson<T>(text);
}
