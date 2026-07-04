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
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export const createNimAiClient = ({
  apiKey,
  model,
  baseUrl,
  fetchImpl = fetch,
  temperature = 0.6,
}: NimAiClientConfig): AiClient => ({
  complete: async (messages: readonly AiMessage[]): Promise<string> => {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `NIM chat completion failed with status ${response.status}${detail ? `: ${detail}` : ''}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('NIM response contained no completion content.');
    }
    return content;
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
