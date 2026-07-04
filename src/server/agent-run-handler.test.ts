import { describe, expect, it } from 'vitest';
import { createAgentRunHandler } from './agent-run-handler';
import { createAgentFactory } from '@/core/agent-factory';
import { AgentType } from '@/core/agent-types';
import { BaseAgent, type AgentServices, type TaskInput } from '@/core/base-agent';
import { successResult, type AgentRunResult } from '@/core/agent-result';
import {
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';

let lastInput: TaskInput | null = null;

class FakeAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'fake';
  }
  protected async executeTask(input: TaskInput): Promise<AgentRunResult> {
    lastInput = input;
    return successResult({ summary: 'ran', output: { echo: input } });
  }
}

class BrokenAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'broken';
  }
  protected async executeTask(): Promise<AgentRunResult> {
    throw new Error('kaput');
  }
}

const services: AgentServices = {
  ai: createStubAiClient(),
  logger: createRecordingLogger(),
  messageBus: createRecordingMessageBus(),
};

const factory = createAgentFactory({
  registry: {
    [AgentType.Research]: FakeAgent,
    [AgentType.Qa]: BrokenAgent,
  },
  services,
});

const handler = createAgentRunHandler({ factory, logger: createRecordingLogger() });

const post = (type: string, body?: unknown) =>
  handler(
    new Request(`http://test.local/api/agents/${type}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { type },
  );

describe('agent run handler', () => {
  it('runs the requested agent and returns its result (FR-15, AC-14)', async () => {
    const response = await post('research', { input: { query: 'acme' } });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe('success');
    expect(payload.summary).toBe('ran');
    expect(lastInput).toEqual({ query: 'acme' });
  });

  it('returns 404 with a structured error for an unknown agent type (§8)', async () => {
    const response = await post('intern', { input: {} });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toMatch(/intern/);
  });

  it('returns 400 for a request body that is not valid JSON', async () => {
    const response = await handler(
      new Request('http://test.local/api/agents/research/run', {
        method: 'POST',
        body: 'not json',
      }),
      { type: 'research' },
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/JSON/i);
  });

  it('treats a missing body as an empty input (empty state)', async () => {
    const response = await post('research');
    expect(response.status).toBe(200);
    expect(lastInput).toEqual({});
  });

  it('returns the failure result with a 200 when the agent task fails (failure is data, not transport error)', async () => {
    const response = await post('qa', { input: {} });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe('failure');
    expect(payload.summary).toContain('kaput');
  });
});
