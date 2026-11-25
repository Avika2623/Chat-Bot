import type { ApiErrorCode, ApiErrorPayload, ModelOption, TokenUsage } from '../src/types.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const NON_CHAT_MODEL_PATTERNS = [
  'whisper',
  'distil-whisper',
  'playai-tts',
  'orpheus',
  'prompt-guard',
  'llama-guard',
];

const FLAGSHIP_PRIORITY = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'qwen-qwq-32b',
  'deepseek-r1-distill-llama-70b',
];

export const FALLBACK_MODELS: ModelOption[] = [
  { id: 'llama-3.3-70b-versatile', ownedBy: 'Meta', category: 'Meta Llama', contextWindow: 131072 },
  { id: 'llama-3.1-8b-instant', ownedBy: 'Meta', category: 'Meta Llama', contextWindow: 131072 },
  { id: 'openai/gpt-oss-120b', ownedBy: 'OpenAI', category: 'Flagship', contextWindow: 131072 },
  { id: 'openai/gpt-oss-20b', ownedBy: 'OpenAI', category: 'Flagship', contextWindow: 131072 },
  { id: 'qwen/qwen3-32b', ownedBy: 'Alibaba', category: 'Reasoning & Qwen', contextWindow: 131072 },
];

export class GroqServiceError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  toJSON(): ApiErrorPayload {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfterSeconds !== undefined ? { retryAfterSeconds: this.retryAfterSeconds } : {}),
      },
    };
  }
}

/** Reads the Groq API key strictly from server environment variables. */
export function getServerApiKey(): string | null {
  const raw = process.env.GROQ_API_KEY?.trim();
  if (!raw || raw === 'your_groq_api_key_here') {
    return null;
  }
  return raw;
}

function requireApiKey(): string {
  const key = getServerApiKey();
  if (!key) {
    throw new GroqServiceError(
      401,
      'MISSING_API_KEY',
      'Server API key is not configured. Set GROQ_API_KEY in your environment or .env file and restart the server.'
    );
  }
  return key;
}

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !NON_CHAT_MODEL_PATTERNS.some((pattern) => lower.includes(pattern));
}

function categorizeModel(id: string, ownedBy: string): ModelOption['category'] {
  const lower = id.toLowerCase();
  if (lower.includes('gpt-oss') || lower.includes('kimi') || lower.includes('compound')) {
    return 'Flagship';
  }
  if (lower.includes('qwen') || lower.includes('deepseek') || lower.includes('qwq')) {
    return 'Reasoning & Qwen';
  }
  if (lower.includes('llama') || ownedBy.toLowerCase().includes('meta')) {
    return 'Meta Llama';
  }
  return 'Other';
}

function sortModels(models: ModelOption[]): ModelOption[] {
  return [...models].sort((a, b) => {
    const idxA = FLAGSHIP_PRIORITY.indexOf(a.id);
    const idxB = FLAGSHIP_PRIORITY.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });
}

/** Maps upstream HTTP errors from Groq into safe, user-friendly errors without leaking secrets. */
export async function mapGroqHttpError(response: Response): Promise<GroqServiceError> {
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
  const validRetry = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined;

  let upstreamMessage = '';
  let upstreamCode = '';
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string; type?: string };
    };
    upstreamMessage = body?.error?.message ?? '';
    upstreamCode = body?.error?.code ?? body?.error?.type ?? '';
  } catch {
    // Ignore non-JSON upstream error bodies
  }

  if (response.status === 401 || response.status === 403) {
    return new GroqServiceError(
      401,
      'INVALID_API_KEY',
      'Authentication with the Groq API failed. Verify that your server-side GROQ_API_KEY is valid and active.'
    );
  }

  if (response.status === 429) {
    const waitNote = validRetry ? ` Try again in ~${validRetry}s.` : ' Please wait briefly and try again.';
    return new GroqServiceError(
      429,
      'RATE_LIMIT',
      `Groq rate limit reached.${waitNote}`,
      validRetry
    );
  }

  const lowerMsg = upstreamMessage.toLowerCase();
  const lowerCode = upstreamCode.toLowerCase();
  if (
    response.status === 404 ||
    lowerCode.includes('model_not_found') ||
    lowerCode.includes('model_decommissioned') ||
    (response.status === 400 && lowerMsg.includes('model'))
  ) {
    return new GroqServiceError(
      400,
      'INVALID_MODEL',
      upstreamMessage || 'The selected model is unavailable or invalid. Choose another model from the list.'
    );
  }

  if (response.status >= 400 && response.status < 500) {
    return new GroqServiceError(
      response.status,
      'BAD_REQUEST',
      upstreamMessage || 'The request was rejected by the model API. Check your parameters and try again.'
    );
  }

  return new GroqServiceError(
    502,
    'UPSTREAM_ERROR',
    upstreamMessage || `Upstream model service returned status ${response.status}. Please try again.`
  );
}

function wrapNetworkError(err: unknown): GroqServiceError {
  if (err instanceof GroqServiceError) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new GroqServiceError(499, 'ABORTED', 'Generation was stopped.');
  }
  return new GroqServiceError(
    502,
    'NETWORK_ERROR',
    'Unable to reach the Groq API. Check your internet connection or try again shortly.'
  );
}

interface RawGroqModel {
  id: string;
  owned_by?: string;
  active?: boolean;
  context_window?: number;
  created?: number;
}

/** Fetches active chat-capable models from Groq's /models endpoint. */
export async function fetchGroqModels(): Promise<ModelOption[]> {
  const apiKey = requireApiKey();

  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    throw wrapNetworkError(err);
  }

  if (!response.ok) {
    throw await mapGroqHttpError(response);
  }

  const payload = (await response.json()) as { data?: RawGroqModel[] };
  const items = Array.isArray(payload.data) ? payload.data : [];

  const chatModels: ModelOption[] = items
    .filter((m) => m.id && m.active !== false && isChatModel(m.id))
    .map((m) => {
      const ownedBy = m.owned_by ?? 'Unknown';
      return {
        id: m.id,
        ownedBy,
        category: categorizeModel(m.id, ownedBy),
        contextWindow: m.context_window,
        created: m.created,
      };
    });

  return sortModels(chatModels);
}

export interface ChatRequestInput {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxCompletionTokens?: number;
  topP?: number;
  stream?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Validates and builds the Groq /chat/completions request body. */
export function buildGroqPayload(input: ChatRequestInput) {
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!model) {
    throw new GroqServiceError(400, 'INVALID_MODEL', 'Please select a model before sending a message.');
  }

  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new GroqServiceError(400, 'EMPTY_MESSAGE', 'Please enter a message before sending.');
  }

  const sanitizedMessages = input.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.trim() : '',
    }))
    .filter((m) => m.content.length > 0);

  const hasUserMessage = sanitizedMessages.some((m) => m.role === 'user');
  if (!hasUserMessage) {
    throw new GroqServiceError(400, 'EMPTY_MESSAGE', 'Message cannot be empty. Type a prompt and try again.');
  }

  const systemText = typeof input.systemPrompt === 'string' ? input.systemPrompt.trim() : '';
  const finalMessages =
    systemText.length > 0 && sanitizedMessages[0]?.role !== 'system'
      ? [{ role: 'system' as const, content: systemText }, ...sanitizedMessages]
      : sanitizedMessages;

  const temperature =
    typeof input.temperature === 'number' && Number.isFinite(input.temperature)
      ? clamp(input.temperature, 0, 2)
      : 0.7;

  const maxCompletionTokens =
    typeof input.maxCompletionTokens === 'number' && Number.isFinite(input.maxCompletionTokens)
      ? Math.round(clamp(input.maxCompletionTokens, 1, 32768))
      : 2048;

  const topP =
    typeof input.topP === 'number' && Number.isFinite(input.topP) ? clamp(input.topP, 0.01, 1) : 1;

  const stream = input.stream !== false;

  return {
    model,
    messages: finalMessages,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    top_p: topP,
    stream,
    n: 1,
  };
}

/** Sends a chat completion request to Groq and returns the raw upstream Response. */
export async function requestGroqCompletion(
  input: ChatRequestInput,
  signal?: AbortSignal
): Promise<Response> {
  const apiKey = requireApiKey();
  const body = buildGroqPayload(input);

  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw wrapNetworkError(err);
  }

  if (!response.ok) {
    throw await mapGroqHttpError(response);
  }

  return response;
}

export function extractUsage(raw: Record<string, unknown> | undefined): TokenUsage | undefined {
  if (!raw) return undefined;
  const promptTokens = typeof raw.prompt_tokens === 'number' ? raw.prompt_tokens : undefined;
  const completionTokens = typeof raw.completion_tokens === 'number' ? raw.completion_tokens : undefined;
  const totalTokens = typeof raw.total_tokens === 'number' ? raw.total_tokens : undefined;
  const totalTime = typeof raw.total_time === 'number' ? raw.total_time : undefined;

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens, totalTime };
}
