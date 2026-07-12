import type { AiClient, AiMessage } from './ai-client';

/**
 * Generic OpenAI-compatible chat completions client.
 * Server-side only — the key must never reach the browser (FR-15).
 */
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

interface OpenAiClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export const createOpenAiClient = ({
  apiKey,
  model,
  baseUrl,
  fetchImpl = fetch,
  temperature = 0.6,
}: OpenAiClientConfig): AiClient => ({
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
        `OpenAI chat completion failed with status ${response.status}${detail ? `: ${detail}` : ''}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI response contained no completion content.');
    }
    return content;
  },
});

export const createOpenAiClientFromEnv = (fetchImpl?: FetchImpl): AiClient => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).',
    );
  }
  return createOpenAiClient({
    apiKey,
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    fetchImpl,
  });
};
