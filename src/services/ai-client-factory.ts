import type { AiClient } from './ai-client';
import { createStubAiClient } from '@/testing/doubles';
import { createNimAiClientFromEnv } from './nim-ai-client';
import { createOpenAiClientFromEnv } from './openai-ai-client';

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

const SUPPORTED_PROVIDERS = ['nim', 'openai', 'stub'] as const;
type AiProvider = (typeof SUPPORTED_PROVIDERS)[number];

const resolveProvider = (): AiProvider => {
  const raw = (process.env.AI_PROVIDER || 'nim').toLowerCase();
  if ((SUPPORTED_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as AiProvider;
  }
  throw new Error(
    `Unknown AI_PROVIDER "${raw}". Supported values: ${SUPPORTED_PROVIDERS.join(', ')}.`,
  );
};

/**
 * Selects an AiClient implementation from AI_PROVIDER (default: nim).
 * Stub mode returns canned JSON without network access — useful for local dev.
 */
export const createAiClientFromEnv = (fetchImpl?: FetchImpl): AiClient => {
  switch (resolveProvider()) {
    case 'nim':
      return createNimAiClientFromEnv(fetchImpl);
    case 'openai':
      return createOpenAiClientFromEnv(fetchImpl);
    case 'stub':
      return createStubAiClient();
  }
};
