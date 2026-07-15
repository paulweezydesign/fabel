import type { AiClient, AiMessage } from './ai-client';

/**
 * NVIDIA NIM exposes an OpenAI-compatible chat completions API.
 * Server-side only — the key must never reach the browser (FR-15).
 */
export const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const DEFAULT_NIM_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

interface NimAiClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  temperature?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }[];
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const extractContent = (payload: ChatCompletionResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (text) return text;
  }
  throw new Error('NIM response contained no completion content.');
};

export const createNimAiClient = ({
  apiKey,
  model,
  baseUrl,
  fetchImpl = fetch,
  temperature = 0.3,
  maxRetries = 3,
  retryDelayMs = 750,
  sleep = defaultSleep,
}: NimAiClientConfig): AiClient => ({
  complete: async (messages: readonly AiMessage[]): Promise<string> => {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ model, messages, temperature, stream: false }),
      });

      if (response.ok) {
        const payload = (await response.json()) as ChatCompletionResponse;
        return extractContent(payload);
      }

      const detail = await response.text().catch(() => '');
      lastError = new Error(
        `NIM chat completion failed with status ${response.status}${detail ? `: ${detail}` : ''}`,
      );

      if (!isRetryableStatus(response.status) || attempt === maxRetries) {
        throw lastError;
      }

      await sleep(retryDelayMs * 2 ** attempt);
      attempt += 1;
    }

    throw lastError ?? new Error('NIM chat completion failed.');
  },
});

export const createNimAiClientFromEnv = (fetchImpl?: FetchImpl): AiClient => {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'NVIDIA_NIM_API_KEY is not set. Add it to .env.local (see .env.example).',
    );
  }
  return createNimAiClient({
    apiKey,
    model: process.env.NVIDIA_NIM_MODEL || DEFAULT_NIM_MODEL,
    baseUrl: process.env.NVIDIA_NIM_BASE_URL || DEFAULT_NIM_BASE_URL,
    fetchImpl,
  });
};
