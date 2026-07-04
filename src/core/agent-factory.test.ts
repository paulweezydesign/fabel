import { describe, expect, it } from 'vitest';
import { createAgentFactory, type AgentRegistry } from './agent-factory';
import { AgentType } from './agent-types';
import { BaseAgent, type AgentServices } from './base-agent';
import { createAgentContext } from './agent-context';
import { successResult, type AgentRunResult } from './agent-result';
import {
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';

class FakeResearchAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'research';
  }
  protected async executeTask(): Promise<AgentRunResult> {
    return successResult({ summary: 'researched', output: {} });
  }
}

class FakeQaAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'qa';
  }
  protected async executeTask(): Promise<AgentRunResult> {
    return successResult({ summary: 'checked', output: {} });
  }
}

const services: AgentServices = {
  ai: createStubAiClient(),
  logger: createRecordingLogger(),
  messageBus: createRecordingMessageBus(),
};

const registry: AgentRegistry = {
  [AgentType.Research]: FakeResearchAgent,
  [AgentType.Qa]: FakeQaAgent,
};

describe('AgentFactory', () => {
  it('creates an instance of the requested type with services injected (AC-5)', async () => {
    const factory = createAgentFactory({ registry, services });

    const agent = factory.createAgent(AgentType.Research, createAgentContext({}));

    expect(agent).toBeInstanceOf(FakeResearchAgent);
    expect(agent.type).toBe(AgentType.Research);
    const result = await agent.assignTask({});
    expect(result.status).toBe('success');
  });

  it('creates the correct subclass per registered type (AC-5)', () => {
    const factory = createAgentFactory({ registry, services });
    expect(factory.createAgent(AgentType.Qa, createAgentContext({}))).toBeInstanceOf(
      FakeQaAgent,
    );
  });

  it('assigns each agent a unique id (FR-6)', () => {
    const factory = createAgentFactory({ registry, services });
    const context = createAgentContext({});

    const ids = [
      factory.createAgent(AgentType.Research, context).id,
      factory.createAgent(AgentType.Research, context).id,
      factory.createAgent(AgentType.Qa, context).id,
    ];

    expect(new Set(ids).size).toBe(3);
  });

  it('passes the context through to the agent', () => {
    const factory = createAgentFactory({ registry, services });
    const context = createAgentContext({ tenantId: 't-9', leadId: 'l-3' });

    const agent = factory.createAgent(AgentType.Research, context);

    expect(agent.context).toEqual({ tenantId: 't-9', leadId: 'l-3' });
  });

  it('throws a descriptive error for an unregistered type (AC-6, FR-7)', () => {
    const factory = createAgentFactory({ registry, services });

    expect(() =>
      factory.createAgent(AgentType.Designer, createAgentContext({})),
    ).toThrow(/designer/);
  });

  it('throws a descriptive error for a value outside the enum (AC-1)', () => {
    const factory = createAgentFactory({ registry, services });

    expect(() =>
      factory.createAgent('intern' as AgentType, createAgentContext({})),
    ).toThrow(/intern/);
  });
});
