export type MessageRole = 'system' | 'user' | 'assistant';

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalTime?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  createdAt: number;
  model?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  status?: 'streaming' | 'loading' | 'done' | 'stopped' | 'error';
  errorText?: string;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxCompletionTokens: number;
  topP: number;
  systemPrompt: string;
  stream: boolean;
}

export interface ModelOption {
  id: string;
  ownedBy: string;
  category: 'Flagship' | 'Meta Llama' | 'Reasoning & Qwen' | 'Other';
  contextWindow?: number;
  created?: number;
}

export type ApiErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'INVALID_MODEL'
  | 'RATE_LIMIT'
  | 'EMPTY_MESSAGE'
  | 'BAD_REQUEST'
  | 'NETWORK_ERROR'
  | 'UPSTREAM_ERROR'
  | 'ABORTED';

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface HealthResponse {
  ok: boolean;
  apiKeyConfigured: boolean;
}
