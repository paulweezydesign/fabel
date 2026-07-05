import { describe, expect, it } from 'vitest';
import {
  createWorkflowRun,
  type WorkflowRunSnapshot,
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

class LoggingAgent extends BaseAgent {
  getDefaultSystemPrompt(): string {
    return 'log';
  }
  protected async executeTask(input: TaskInput): Promise<AgentRunResult> {
    return successResult({
      summary: 'done',
      output: { step: input.stepTitle },
    });
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
};

const definition = {
  id: 'lead-to-outreach',
  name: 'Lead → Outreach',
  projectId: 'proj-1',
  steps: [
    { id: 's1', title: 'Research', agentType: AgentType.Research },
    {
      id: 's2',
      title: 'Outreach',
      agentType: AgentType.ClientGrowth,
      dependsOn: ['s1'],
      requiresApproval: true,
    },
  ],
} as const;

describe('WorkflowRun snapshot', () => {
  it('captures serialisable state after start pauses for review', async () => {
    const run = createWorkflowRun({
      definition,
      factory: createAgentFactory({ registry, services }),
      artifactStore: createInMemoryArtifactStore(),
      logger: createRecordingLogger(),
    });

    await run.start({ leadName: 'Acme' });
    const snapshot = run.getSnapshot();

    expect(snapshot).toMatchObject({
      id: run.id,
      definitionId: 'lead-to-outreach',
      projectId: 'proj-1',
      status: 'needs_review',
      pendingApprovalStepId: 's2',
      workflowInput: { leadName: 'Acme' },
      stepStatuses: { s1: 'completed', s2: 'completed' },
      approvedStepIds: [],
    });
    expect(snapshot.startedAt).toBeTruthy();
    expect(snapshot.createdAt).toBeTruthy();
    expect(snapshot.updatedAt).toBeTruthy();
  });

  it('resumes from a snapshot after approval across separate instances', async () => {
    const artifactStore = createInMemoryArtifactStore();
    const factory = createAgentFactory({ registry, services });
    const logger = createRecordingLogger();

    const first = createWorkflowRun({
      definition,
      factory,
      artifactStore,
      logger,
    });
    await first.start({ leadName: 'Acme' });
    const paused = first.getSnapshot();

    const resumed = createWorkflowRun({
      definition,
      factory,
      artifactStore,
      logger,
      snapshot: paused,
    });
    await resumed.approve('s2');

    expect(resumed.status).toBe('completed');
    expect(resumed.getSnapshot().status).toBe('completed');
    expect(resumed.getSnapshot().approvedStepIds).toEqual(['s2']);
  });

  it('rejects start when restored from a non-pending snapshot', async () => {
    const artifactStore = createInMemoryArtifactStore();
    const factory = createAgentFactory({ registry, services });
    const logger = createRecordingLogger();

    const run = createWorkflowRun({
      definition,
      factory,
      artifactStore,
      logger,
    });
    await run.start({});
    const snapshot = run.getSnapshot();

    const restored = createWorkflowRun({
      definition,
      factory,
      artifactStore,
      logger,
      snapshot,
    });

    await expect(restored.start({})).rejects.toThrow(/pending/);
  });
});

describe('WorkflowRunSnapshot type guard', () => {
  it('is exported as a plain serialisable record', () => {
    const snapshot: WorkflowRunSnapshot = {
      id: 'run-1',
      definitionId: 'lead-to-outreach',
      projectId: 'proj-1',
      status: 'needs_review',
      startedAt: new Date().toISOString(),
      pendingApprovalStepId: 's2',
      error: null,
      stepStatuses: { s1: 'completed', s2: 'completed' },
      approvedStepIds: [],
      workflowInput: { leadName: 'Acme' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
