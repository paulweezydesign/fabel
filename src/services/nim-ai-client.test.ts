import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNimAiClient, createNimAiClientFromEnv } from './nim-ai-client';
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

describe('createNimAiClient', () => {
  it('posts an OpenAI-compatible chat completion request to the NIM endpoint', async () => {
    const fetchMock = vi.fn(async () => okResponse('hello'));
    const client = createNimAiClient({
      apiKey: 'nvapi-test',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      fetchImpl: fetchMock,
    });

    const reply = await client.complete(messages);

    expect(reply).toBe('hello');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer nvapi-test',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    expect(body.messages).toEqual(messages);
  });

  it('throws a descriptive error on a non-2xx response', async () => {
    const fetchMock = vi.fn(
      async () => new Response('Unauthorized', { status: 401 }),
    );
    const client = createNimAiClient({
      apiKey: 'nvapi-bad',
      model: 'm',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
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
    const client = createNimAiClient({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x.example',
      fetchImpl: fetchMock,
    });

    await expect(client.complete(messages)).rejects.toThrow(/no completion/i);
  });
});

describe('createNimAiClientFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads key, model and base url from the environment', async () => {
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'nvapi-env');
    vi.stubEnv('NVIDIA_NIM_MODEL', 'nvidia/custom-model');
    vi.stubEnv('NVIDIA_NIM_BASE_URL', 'https://custom.example/v1');
    const fetchMock = vi.fn(async () => okResponse('env hello'));

    const client = createNimAiClientFromEnv(fetchMock);
    await client.complete(messages);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://custom.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer nvapi-env',
    );
    expect(JSON.parse(init.body as string).model).toBe('nvidia/custom-model');
  });

  it('defaults model and base url when not set', async () => {
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'nvapi-env');
    vi.stubEnv('NVIDIA_NIM_MODEL', '');
    vi.stubEnv('NVIDIA_NIM_BASE_URL', '');
    const fetchMock = vi.fn(async () => okResponse('ok'));

    const client = createNimAiClientFromEnv(fetchMock);
    await client.complete(messages);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(JSON.parse(init.body as string).model).toBe(
      'nvidia/nemotron-3-ultra-550b-a55b',
    );
  });

  it('fails fast when the API key is missing', () => {
    vi.stubEnv('NVIDIA_NIM_API_KEY', '');
    expect(() => createNimAiClientFromEnv()).toThrow(/NVIDIA_NIM_API_KEY/);
  });
});
