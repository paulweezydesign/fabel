import { describe, expect, it } from 'vitest';
import {
  createWorkflowRun,
  type WorkflowDefinition,
  type WorkflowStep,
} from './workflow-runner';
import { createAgentFactory, type AgentRegistry } from './agent-factory';
import { createInMemoryArtifactStore } from './artifact-store';
import { AgentType } from './agent-types';
import { BaseAgent, type AgentServices, type TaskInput } from './base-agent';
import { successResult, type AgentRunResult } from './agent-result';
import {
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';

/** Records execution order and the input each agent received. */
const executionLog: { agentType: AgentType; input: TaskInput }[] = [];

class LoggingAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'log';
  }
  protected async executeTask(input: TaskInput): Promise<AgentRunResult> {
    executionLog.push({ agentType: this.type, input });
    return successResult({
      summary: `${this.type} done`,
      output: { producedBy: this.type },
    });
  }
}

class FailingAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'fail';
  }
  protected async executeTask(): Promise<AgentRunResult> {
    throw new Error('agent blew up');
  }
}

class MalformedAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'malformed';
  }
  protected async executeTask(): Promise<AgentRunResult> {
    return { nonsense: true } as unknown as AgentRunResult;
  }
}

const services: AgentServices = {
  ai: createStubAiClient(),
  logger: createRecordingLogger(),
  messageBus: createRecordingMessageBus(),
};

const registry: AgentRegistry = {
  [AgentType.Research]: LoggingAgent,
  [AgentType.ClientGrowth]: LoggingAgent,
  [AgentType.ProjectManager]: LoggingAgent,
  [AgentType.Designer]: LoggingAgent,
  [AgentType.Qa]: FailingAgent,
  [AgentType.TechLead]: MalformedAgent,
};

const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf-def',
  name: 'test workflow',
  projectId: 'proj-1',
  steps,
});

const makeRun = (steps: WorkflowStep[]) => {
  executionLog.length = 0;
  const artifactStore = createInMemoryArtifactStore();
  const factory = createAgentFactory({ registry, services });
  const run = createWorkflowRun({
    definition: definition(steps),
    factory,
    artifactStore,
    logger: createRecordingLogger(),
  });
  return { run, artifactStore };
};

describe('WorkflowRun', () => {
  it('completes an empty workflow immediately with zero artifacts (empty state)', async () => {
    const { run, artifactStore } = makeRun([]);

    await run.start({});

    expect(run.status).toBe('completed');
    expect(await artifactStore.listByWorkflow(run.id)).toEqual([]);
  });

  it('marks the workflow running and records startedAt (FR-10)', async () => {
    const { run } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
    ]);

    expect(run.startedAt).toBeNull();
    await run.start({});

    expect(run.startedAt).not.toBeNull();
    expect(run.status).toBe('completed');
  });

  it('executes steps in dependency order, not declaration order (AC-7)', async () => {
    const { run } = makeRun([
      {
        id: 'draft',
        title: 'Draft outreach',
        agentType: AgentType.ClientGrowth,
        dependsOn: ['research'],
      },
      { id: 'research', title: 'Research', agentType: AgentType.Research },
    ]);

    await run.start({});

    expect(executionLog.map((e) => e.agentType)).toEqual([
      AgentType.Research,
      AgentType.ClientGrowth,
    ]);
    expect(run.status).toBe('completed');
  });

  it('saves an artifact per completed step with workflow, project and agent fields (AC-11)', async () => {
    const { run, artifactStore } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
      {
        id: 's2',
        title: 'Outreach plan',
        agentType: AgentType.ClientGrowth,
        dependsOn: ['s1'],
      },
    ]);

    await run.start({});

    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]).toMatchObject({
      workflowId: run.id,
      projectId: 'proj-1',
      agentType: AgentType.Research,
      title: 'Research',
    });
    expect(artifacts[1].title).toBe('Outreach plan');
  });

  it('hands prior artifacts and workflow input to subsequent steps', async () => {
    const { run } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
      {
        id: 's2',
        title: 'Outreach',
        agentType: AgentType.ClientGrowth,
        dependsOn: ['s1'],
      },
    ]);

    await run.start({ leadName: 'Acme' });

    const [, second] = executionLog;
    expect(second.input.workflowInput).toEqual({ leadName: 'Acme' });
    const priorArtifacts = second.input.priorArtifacts as { title: string }[];
    expect(priorArtifacts.map((a) => a.title)).toEqual(['Research']);
  });

  it('pauses in needs_review after an approval-gated step runs; later steps wait (AC-8)', async () => {
    const { run, artifactStore } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
      {
        id: 's2',
        title: 'Outreach plan',
        agentType: AgentType.ClientGrowth,
        dependsOn: ['s1'],
        requiresApproval: true,
      },
      {
        id: 's3',
        title: 'Brief',
        agentType: AgentType.ProjectManager,
        dependsOn: ['s2'],
      },
    ]);

    await run.start({});

    expect(run.status).toBe('needs_review');
    expect(run.pendingApprovalStepId).toBe('s2');
    // the gated step's output is reviewable
    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts.map((a) => a.title)).toEqual(['Research', 'Outreach plan']);
    // the dependent step has not run
    expect(executionLog.map((e) => e.agentType)).toEqual([
      AgentType.Research,
      AgentType.ClientGrowth,
    ]);
  });

  it('resumes from the paused step successor after approval (AC-9)', async () => {
    const { run } = makeRun([
      {
        id: 's1',
        title: 'Outreach plan',
        agentType: AgentType.ClientGrowth,
        requiresApproval: true,
      },
      {
        id: 's2',
        title: 'Brief',
        agentType: AgentType.ProjectManager,
        dependsOn: ['s1'],
      },
    ]);

    await run.start({});
    expect(run.status).toBe('needs_review');

    await run.approve('s1');

    expect(run.status).toBe('completed');
    // s1 ran exactly once — approval resumes, it does not re-run
    expect(executionLog.map((e) => e.agentType)).toEqual([
      AgentType.ClientGrowth,
      AgentType.ProjectManager,
    ]);
  });

  it('remains needs_review until approval is granted (valid resting state)', async () => {
    const { run } = makeRun([
      {
        id: 's1',
        title: 'Outreach',
        agentType: AgentType.ClientGrowth,
        requiresApproval: true,
      },
    ]);

    await run.start({});

    expect(run.status).toBe('needs_review');
    await expect(run.approve('wrong-step')).rejects.toThrow(/wrong-step/);
    expect(run.status).toBe('needs_review');
  });

  it('rejects approve when nothing is awaiting review', async () => {
    const { run } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
    ]);
    await run.start({});
    await expect(run.approve('s1')).rejects.toThrow(/review/);
  });

  it('halts on step failure; earlier artifacts stay retrievable (FR-11, AC-10)', async () => {
    const { run, artifactStore } = makeRun([
      { id: 's1', title: 'Research', agentType: AgentType.Research },
      { id: 's2', title: 'QA check', agentType: AgentType.Qa, dependsOn: ['s1'] },
      {
        id: 's3',
        title: 'Never runs',
        agentType: AgentType.ProjectManager,
        dependsOn: ['s2'],
      },
    ]);

    await run.start({});

    expect(run.status).toBe('failed');
    expect(run.stepStatus('s2')).toBe('failed');
    expect(run.stepStatus('s3')).toBe('pending');
    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts.map((a) => a.title)).toEqual(['Research']);
  });

  it('treats a malformed agent result as a step failure (validation at the runner boundary)', async () => {
    const { run } = makeRun([
      { id: 's1', title: 'Plan', agentType: AgentType.TechLead },
    ]);

    await run.start({});

    expect(run.status).toBe('failed');
    expect(run.stepStatus('s1')).toBe('failed');
    expect(run.error).toMatch(/malformed|conform/i);
  });

  it('refuses to start a workflow with unknown dependencies, naming the step', async () => {
    const { run } = makeRun([
      {
        id: 's1',
        title: 'Research',
        agentType: AgentType.Research,
        dependsOn: ['ghost'],
      },
    ]);

    await expect(run.start({})).rejects.toThrow(/ghost/);
  });

  it('refuses to start a workflow with circular dependencies, naming the steps', async () => {
    const { run } = makeRun([
      { id: 'a', title: 'A', agentType: AgentType.Research, dependsOn: ['b'] },
      { id: 'b', title: 'B', agentType: AgentType.Research, dependsOn: ['a'] },
    ]);

    await expect(run.start({})).rejects.toThrow(/circular/i);
  });

  it('rejects starting a run that is already running or under review (concurrency guard)', async () => {
    const { run } = makeRun([
      {
        id: 's1',
        title: 'Outreach',
        agentType: AgentType.ClientGrowth,
        requiresApproval: true,
      },
    ]);

    await run.start({});
    expect(run.status).toBe('needs_review');
    await expect(run.start({})).rejects.toThrow(/needs_review/);
  });
});
