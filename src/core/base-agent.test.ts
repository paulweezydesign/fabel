import { describe, expect, it } from 'vitest';
import { BaseAgent, type AgentServices } from './base-agent';
import { AgentType } from './agent-types';
import { createAgentContext } from './agent-context';
import { successResult, type AgentRunResult } from './agent-result';
import {
  createFailingAiClient,
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';

class EchoAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'You are an echo agent.';
  }

  protected async executeTask(input: Record<string, unknown>): Promise<AgentRunResult> {
    const reply = await this.ai.complete([
      { role: 'system', content: this.getDefaultSystemPrompt() },
      { role: 'user', content: JSON.stringify(input) },
    ]);
    return successResult({ summary: 'echoed', output: { reply } });
  }
}

class ThrowingAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'You always fail.';
  }

  protected async executeTask(): Promise<AgentRunResult> {
    throw new Error('task exploded');
  }
}

const makeServices = (overrides: Partial<AgentServices> = {}): AgentServices => ({
  ai: createStubAiClient(() => 'stubbed reply'),
  logger: createRecordingLogger(),
  messageBus: createRecordingMessageBus(),
  ...overrides,
});

const makeAgent = (services = makeServices()) =>
  new EchoAgent({
    id: 'agent-1',
    type: AgentType.Research,
    context: createAgentContext({ tenantId: 't-1' }),
    services,
  });

describe('BaseAgent', () => {
  it('stores identity and context (FR-4)', () => {
    const agent = makeAgent();
    expect(agent.id).toBe('agent-1');
    expect(agent.type).toBe(AgentType.Research);
    expect(agent.context).toEqual({ tenantId: 't-1' });
  });

  it('starts with task status pending', () => {
    expect(makeAgent().taskStatus).toBe('pending');
  });

  it('transitions pending → in_progress → completed on success (AC-2)', async () => {
    const agent = makeAgent();
    const observed: string[] = [];

    const resultPromise = agent.assignTask({ query: 'hello' });
    observed.push(agent.taskStatus);
    const result = await resultPromise;
    observed.push(agent.taskStatus);

    expect(observed).toEqual(['in_progress', 'completed']);
    expect(result.status).toBe('success');
  });

  it('rejects a second assignTask once a task has started (AC-2)', async () => {
    const agent = makeAgent();
    await agent.assignTask({});
    await expect(agent.assignTask({})).rejects.toThrow(/pending/);
  });

  it('marks the task failed and returns a failure result when executeTask throws (AC-3)', async () => {
    const services = makeServices();
    const agent = new ThrowingAgent({
      id: 'agent-2',
      type: AgentType.Qa,
      context: createAgentContext({}),
      services,
    });

    const result = await agent.assignTask({});

    expect(agent.taskStatus).toBe('failed');
    expect(result.status).toBe('failure');
    expect(result.summary).toContain('task exploded');
  });

  it('marks the task failed when the AI client errors (AC-3)', async () => {
    const agent = makeAgent(
      makeServices({ ai: createFailingAiClient('nim timeout') }),
    );

    const result = await agent.assignTask({ query: 'x' });

    expect(agent.taskStatus).toBe('failed');
    expect(result.status).toBe('failure');
    expect(result.summary).toContain('nim timeout');
  });

  it('delegates AI calls to the injected client only (AC-4)', async () => {
    const ai = createStubAiClient(() => 'stubbed reply');
    const agent = makeAgent(makeServices({ ai }));

    const result = await agent.assignTask({ query: 'hello' });

    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].messages[0]).toEqual({
      role: 'system',
      content: 'You are an echo agent.',
    });
    expect(result.output).toEqual({ reply: 'stubbed reply' });
  });

  it('publishes lifecycle events on the message bus', async () => {
    const messageBus = createRecordingMessageBus();
    const agent = makeAgent(makeServices({ messageBus }));

    await agent.assignTask({});

    const topics = messageBus.published.map((m) => m.topic);
    expect(topics).toEqual(['agent.task.started', 'agent.task.completed']);
  });

  it('publishes a failed lifecycle event on failure', async () => {
    const messageBus = createRecordingMessageBus();
    const agent = new ThrowingAgent({
      id: 'agent-3',
      type: AgentType.Qa,
      context: createAgentContext({}),
      services: makeServices({ messageBus }),
    });

    await agent.assignTask({});

    const topics = messageBus.published.map((m) => m.topic);
    expect(topics).toEqual(['agent.task.started', 'agent.task.failed']);
  });
});
