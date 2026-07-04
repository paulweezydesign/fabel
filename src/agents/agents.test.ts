import { describe, expect, it } from 'vitest';
import { AgentType } from '@/core/agent-types';
import { createAgentContext } from '@/core/agent-context';
import type { AgentServices, BaseAgentInit } from '@/core/base-agent';
import {
  createFailingAiClient,
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';
import { ProjectManagerAgent } from './project-manager-agent';
import { ResearchAgent } from './research-agent';
import { DesignerAgent } from './designer-agent';
import { TechLeadAgent } from './tech-lead-agent';
import { FullStackEngineerAgent } from './full-stack-engineer-agent';
import { QaAgent } from './qa-agent';
import { ClientGrowthAgent } from './client-growth-agent';
import { defaultAgentRegistry } from './registry';
import { AGENT_TYPES } from '@/core/agent-types';

const agentCases = [
  {
    Agent: ProjectManagerAgent,
    type: AgentType.ProjectManager,
    promptKeyword: /milestone/i,
    payload: { milestones: [{ title: 'Kickoff' }], blockers: [] },
  },
  {
    Agent: ResearchAgent,
    type: AgentType.Research,
    promptKeyword: /research/i,
    payload: { facts: ['Sells shoes'], sources: ['acme.com'] },
  },
  {
    Agent: DesignerAgent,
    type: AgentType.Designer,
    promptKeyword: /brand/i,
    payload: { direction: 'Minimal', palette: ['#000'] },
  },
  {
    Agent: TechLeadAgent,
    type: AgentType.TechLead,
    promptKeyword: /architecture/i,
    payload: { stack: ['Next.js'], fileStructure: ['src/'] },
  },
  {
    Agent: FullStackEngineerAgent,
    type: AgentType.FullStackEngineer,
    promptKeyword: /code/i,
    payload: { files: [{ path: 'src/index.ts', contents: 'export {};' }] },
  },
  {
    Agent: QaAgent,
    type: AgentType.Qa,
    promptKeyword: /acceptance criteria/i,
    payload: { acceptanceCriteria: ['loads'], checklist: ['test on mobile'] },
  },
  {
    Agent: ClientGrowthAgent,
    type: AgentType.ClientGrowth,
    promptKeyword: /outreach/i,
    payload: { outreachPlan: 'Email then call', touchpoints: 2 },
  },
] as const;

const makeServices = (aiReply: unknown): AgentServices => ({
  ai: createStubAiClient(() => JSON.stringify(aiReply)),
  logger: createRecordingLogger(),
  messageBus: createRecordingMessageBus(),
});

const init = (
  type: AgentType,
  services: AgentServices,
): BaseAgentInit => ({
  id: `agent-${type}`,
  type,
  context: createAgentContext({ tenantId: 't-1', projectId: 'p-1' }),
  services,
});

describe.each(agentCases)('$type agent', ({ Agent, type, promptKeyword, payload }) => {
  it('returns structured output parsed from the model reply (FR-5, §6.6)', async () => {
    const reply = { summary: 'did the work', ...payload };
    const agent = new Agent(init(type, makeServices(reply)));

    const result = await agent.assignTask({ workflowInput: { goal: 'launch' } });

    expect(result.status).toBe('success');
    expect(result.summary).toBe('did the work');
    expect(result.output).toMatchObject(payload);
  });

  it('shapes the model with a role-specific system prompt', async () => {
    const services = makeServices({ summary: 's' });
    const agent = new Agent(init(type, services));
    expect(agent.getDefaultSystemPrompt()).toMatch(promptKeyword);
    expect(agent.getDefaultSystemPrompt()).toMatch(/JSON/);

    await agent.assignTask({});

    const stub = services.ai as ReturnType<typeof createStubAiClient>;
    expect(stub.calls[0].messages[0].role).toBe('system');
    expect(stub.calls[0].messages[0].content).toBe(agent.getDefaultSystemPrompt());
  });

  it('lifts questions and risks from the model reply into the result', async () => {
    const reply = {
      summary: 's',
      questions: ['Budget?'],
      risks: ['Tight timeline'],
      ...payload,
    };
    const agent = new Agent(init(type, makeServices(reply)));

    const result = await agent.assignTask({});

    expect(result.questions).toEqual(['Budget?']);
    expect(result.risks).toEqual(['Tight timeline']);
  });

  it('returns a failure result when the AI client errors (AC-3)', async () => {
    const agent = new Agent(
      init(type, {
        ai: createFailingAiClient('nim down'),
        logger: createRecordingLogger(),
        messageBus: createRecordingMessageBus(),
      }),
    );

    const result = await agent.assignTask({});

    expect(result.status).toBe('failure');
    expect(result.summary).toContain('nim down');
  });
});

describe('agent prompt inputs', () => {
  it('includes workflow input and prior artifacts in the user message', async () => {
    const services = makeServices({ summary: 's' });
    const agent = new ResearchAgent(init(AgentType.Research, services));

    await agent.assignTask({
      workflowInput: { leadName: 'Acme Corp' },
      priorArtifacts: [{ title: 'Earlier research', content: { note: 'x' } }],
    });

    const stub = services.ai as ReturnType<typeof createStubAiClient>;
    const userMessage = stub.calls[0].messages[1].content;
    expect(userMessage).toContain('Acme Corp');
    expect(userMessage).toContain('Earlier research');
  });

  it('fails the task when the model returns non-JSON prose', async () => {
    const services: AgentServices = {
      ai: createStubAiClient(() => 'Sure! I will get right on that.'),
      logger: createRecordingLogger(),
      messageBus: createRecordingMessageBus(),
    };
    const agent = new ResearchAgent(init(AgentType.Research, services));

    const result = await agent.assignTask({});

    expect(result.status).toBe('failure');
    expect(result.summary).toMatch(/JSON/);
  });
});

describe('defaultAgentRegistry', () => {
  it('registers every agent type (FR-8)', () => {
    AGENT_TYPES.forEach((type) => {
      expect(defaultAgentRegistry[type], `missing ${type}`).toBeTypeOf('function');
    });
  });
});
