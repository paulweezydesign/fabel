import { describe, expect, it, vi } from 'vitest';
import { createAgentClient } from './agent-client-factory';
import { AgentType } from '@/core/agent-types';

const okResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('createAgentClient', () => {
  it('posts input to the agent route and returns the parsed result (AC-14)', async () => {
    const result = {
      status: 'success',
      summary: 'done',
      output: { facts: [] },
      questions: [],
      risks: [],
    };
    const fetchMock = vi.fn(async () => okResponse(result));

    const client = createAgentClient(AgentType.Research, fetchMock);
    const received = await client.run({ query: 'acme' });

    expect(received).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/agents/research/run');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ input: { query: 'acme' } });
  });

  it('keeps the interface identical across agent types (FR-16)', async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({ status: 'success', summary: 's', output: {}, questions: [], risks: [] }),
    );

    await createAgentClient(AgentType.ClientGrowth, fetchMock).run({});

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/agents/client_growth/run');
  });

  it('rejects unknown agent types before any network call', async () => {
    const fetchMock = vi.fn();
    expect(() => createAgentClient('intern' as AgentType, fetchMock)).toThrow(/intern/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces non-2xx responses as structured errors, not unhandled rejections (AC-15)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'No agent registered for type "designer".' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const client = createAgentClient(AgentType.Designer, fetchMock);

    await expect(client.run({})).rejects.toMatchObject({
      name: 'AgentClientError',
      status: 404,
      message: expect.stringContaining('designer'),
    });
  });

  it('handles non-JSON error bodies gracefully', async () => {
    const fetchMock = vi.fn(async () => new Response('Bad Gateway', { status: 502 }));

    const client = createAgentClient(AgentType.Research, fetchMock);

    await expect(client.run({})).rejects.toMatchObject({ status: 502 });
  });
});
