import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiClient, createOpenAiClientFromEnv } from './openai-ai-client';
import type { AiMessage } from './ai-client';

const messages: AiMessage[] = [
  { role: 'system', content: 'You are a helpful agent.' },
  { role: 'user', content: 'Say hi' },
];

const okResponse = (content: string) =>
  new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('createOpenAiClient', () => {
  it('posts an OpenAI-compatible chat completion request', async () => {
    const fetchMock = vi.fn(async () => okResponse('hello'));
    const client = createOpenAiClient({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      fetchImpl: fetchMock,
    });

    const reply = await client.complete(messages);

    expect(reply).toBe('hello');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-test',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toEqual(messages);
  });

  it('throws a descriptive error on a non-2xx response', async () => {
    const fetchMock = vi.fn(
      async () => new Response('Unauthorized', { status: 401 }),
    );
    const client = createOpenAiClient({
      apiKey: 'sk-bad',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      fetchImpl: fetchMock,
    });

    await expect(client.complete(messages)).rejects.toThrow(/401/);
  });

  it('throws when the response has no completion content', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const client = createOpenAiClient({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      fetchImpl: fetchMock,
    });

    await expect(client.complete(messages)).rejects.toThrow(/no completion/i);
  });
});

describe('createOpenAiClientFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads key, model and base url from the environment', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-env');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4o-mini');
    vi.stubEnv('OPENAI_BASE_URL', 'https://custom.example/v1');
    const fetchMock = vi.fn(async () => okResponse('env hello'));

    const client = createOpenAiClientFromEnv(fetchMock);
    await client.complete(messages);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://custom.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-env',
    );
    expect(JSON.parse(init.body as string).model).toBe('gpt-4o-mini');
  });

  it('defaults model and base url when not set', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-env');
    vi.stubEnv('OPENAI_MODEL', '');
    vi.stubEnv('OPENAI_BASE_URL', '');
    const fetchMock = vi.fn(async () => okResponse('ok'));

    const client = createOpenAiClientFromEnv(fetchMock);
    await client.complete(messages);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(JSON.parse(init.body as string).model).toBe('gpt-4o');
  });

  it('fails fast when the API key is missing', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => createOpenAiClientFromEnv()).toThrow(/OPENAI_API_KEY/);
  });
});
