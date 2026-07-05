import { describe, expect, it } from 'vitest';
import {
  createDeferredTaskQueue,
  createWorkflowService,
} from './workflow-service';
import { createInMemoryWorkflowRunStore } from '@/core/workflow-run-store';
import { createInMemoryArtifactStore } from '@/core/artifact-store';
import { createAgentFactory } from '@/core/agent-factory';
import { defaultAgentRegistry } from '@/agents/registry';
import {
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';
import { AgentType } from '@/core/agent-types';

const makeService = () => {
  const artifactStore = createInMemoryArtifactStore();
  const runStore = createInMemoryWorkflowRunStore();
  const logger = createRecordingLogger();
  const queue = createDeferredTaskQueue();

  const service = createWorkflowService({
    runStore,
    artifactStore,
    factory: createAgentFactory({
      registry: defaultAgentRegistry,
      services: {
        ai: createStubAiClient(() =>
          JSON.stringify({ summary: 'stubbed work', detail: 'done' }),
        ),
        logger,
        messageBus: createRecordingMessageBus(),
      },
    }),
    logger,
    schedule: queue.schedule,
  });

  return { service, artifactStore, runStore, queue };
};

describe('WorkflowService', () => {
  it('starts a known workflow, persists state, and pauses at the approval gate', async () => {
    const { service, runStore, queue } = makeService();

    const run = await service.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: { leadName: 'Acme' },
    });
    expect(run.status).toBe('running');

    await queue.flush();

    const stored = await runStore.getById(run.id);
    expect(stored?.status).toBe('needs_review');
    expect(stored?.definitionId).toBe('lead-to-outreach');
  });

  it('returns a run with its artifacts', async () => {
    const { service, artifactStore, queue } = makeService();
    const started = await service.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: {},
    });
    await queue.flush();

    const detail = await service.getRun(started.id);

    expect(detail.run.id).toBe(started.id);
    expect(detail.artifacts.length).toBeGreaterThan(0);
    expect(detail.artifacts.every((a) => a.workflowId === started.id)).toBe(true);
    expect(await artifactStore.listByWorkflow(started.id)).toHaveLength(
      detail.artifacts.length,
    );
  });

  it('approves a paused run and completes it across separate service calls', async () => {
    const { service, queue } = makeService();
    const started = await service.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: {},
    });
    await queue.flush();

    const paused = (await service.getRun(started.id)).run;
    const approving = await service.approve(paused.id, paused.pendingApprovalStepId!);
    expect(approving.status).toBe('running');

    await queue.flush();

    expect((await service.getRun(paused.id)).run.status).toBe('completed');
  });

  it('throws for an unknown workflow id', async () => {
    const { service } = makeService();
    await expect(
      service.start('does-not-exist', { projectId: 'p', input: {} }),
    ).rejects.toThrow(/does-not-exist/);
  });

  it('throws when approving a run that is not awaiting review', async () => {
    const { service, queue } = makeService();
    const started = await service.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: {},
    });
    await queue.flush();

    const paused = (await service.getRun(started.id)).run;
    await service.approve(paused.id, paused.pendingApprovalStepId!);
    await queue.flush();

    await expect(service.approve(paused.id, 'draft-outreach')).rejects.toThrow(/review/);
  });

  it('throws when fetching an unknown run id', async () => {
    const { service } = makeService();
    await expect(service.getRun('missing')).rejects.toThrow(/missing/);
  });

  it('lists available workflow definitions', () => {
    const { service } = makeService();
    const ids = service.listDefinitions().map((d) => d.id);
    expect(ids).toEqual([
      'lead-to-outreach',
      'intake-to-project-brief',
      'brief-to-build-plan',
    ]);
  });

  it('runs intake-to-project-brief through its approval gate', async () => {
    const { service, queue } = makeService();
    const run = await service.start('intake-to-project-brief', {
      projectId: 'proj-1',
      input: { client: 'Acme' },
    });
    await queue.flush();

    const paused = (await service.getRun(run.id)).run;
    expect(paused.status).toBe('needs_review');
    expect(paused.stepStatuses['compose-brief']).toBe('completed');

    await service.approve(paused.id, paused.pendingApprovalStepId!);
    await queue.flush();

    expect((await service.getRun(paused.id)).run.status).toBe('completed');
  });

  it('runs brief-to-build-plan and records the expected agent sequence in artifacts', async () => {
    const { service, queue } = makeService();
    const run = await service.start('brief-to-build-plan', {
      projectId: 'proj-1',
      input: {},
    });
    await queue.flush();

    const detail = await service.getRun(run.id);
    expect(detail.artifacts.map((a) => a.agentType)).toEqual([
      AgentType.Designer,
      AgentType.TechLead,
      AgentType.Qa,
    ]);
  });
});
