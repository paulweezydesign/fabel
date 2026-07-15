import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiClientFromEnv } from './ai-client-factory';
import type { AiMessage } from './ai-client';

const messages: AiMessage[] = [{ role: 'user', content: 'ping' }];

const okResponse = (content: string) =>
  new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('createAiClientFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the NIM provider when AI_PROVIDER is unset', async () => {
    vi.stubEnv('AI_PROVIDER', '');
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'nvapi-test');
    const fetchMock = vi.fn(async () => okResponse('nim reply'));

    const client = createAiClientFromEnv(fetchMock);
    const reply = await client.complete(messages);

    expect(reply).toBe('nim reply');
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('integrate.api.nvidia.com');
  });

  it('selects NIM when AI_PROVIDER=nim', async () => {
    vi.stubEnv('AI_PROVIDER', 'nim');
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'nvapi-test');
    const fetchMock = vi.fn(async () => okResponse('nim'));

    await createAiClientFromEnv(fetchMock).complete(messages);

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('integrate.api.nvidia.com');
  });

  it('selects OpenAI when AI_PROVIDER=openai', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const fetchMock = vi.fn(async () => okResponse('openai reply'));

    const client = createAiClientFromEnv(fetchMock);
    const reply = await client.complete(messages);

    expect(reply).toBe('openai reply');
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.openai.com');
  });

  it('selects stub when AI_PROVIDER=stub without network or API keys', async () => {
    vi.stubEnv('AI_PROVIDER', 'stub');

    const client = createAiClientFromEnv();
    const reply = await client.complete([
      { role: 'user', content: 'Task: Draft a personalised outreach plan\nInput:\n{}' },
    ]);
    const payload = JSON.parse(reply);

    expect(payload.message).toBeTruthy();
    expect(payload.summary).toBeTruthy();
  });

  it('fails fast for an unknown AI_PROVIDER', () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic');
    expect(() => createAiClientFromEnv()).toThrow(/unknown.*AI_PROVIDER/i);
    expect(() => createAiClientFromEnv()).toThrow(/anthropic/);
  });

  it('fails fast when NIM is selected but the API key is missing', () => {
    vi.stubEnv('AI_PROVIDER', 'nim');
    vi.stubEnv('NVIDIA_NIM_API_KEY', '');
    expect(() => createAiClientFromEnv()).toThrow(/NVIDIA_NIM_API_KEY/);
  });

  it('fails fast when OpenAI is selected but the API key is missing', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => createAiClientFromEnv()).toThrow(/OPENAI_API_KEY/);
  });
});
