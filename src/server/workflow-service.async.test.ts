import { describe, expect, it } from 'vitest';
import {
  createDeferredTaskQueue,
  createWorkflowService,
  type TaskScheduler,
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

const makeService = (schedule?: TaskScheduler) => {
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
    schedule: schedule ?? queue.schedule,
  });

  return { service, runStore, queue };
};

describe('createDeferredTaskQueue', () => {
  it('runs tasks only when flushed', async () => {
    const queue = createDeferredTaskQueue();
    let ran = false;
    queue.schedule(async () => {
      ran = true;
    });
    expect(ran).toBe(false);
    await queue.flush();
    expect(ran).toBe(true);
  });
});

describe('WorkflowService async execution', () => {
  it('returns running immediately before background work finishes', async () => {
    const { service, runStore, queue } = makeService();

    const run = await service.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: { leadName: 'Acme' },
    });

    expect(run.status).toBe('running');
    expect(run.startedAt).toBeTruthy();
    expect(await runStore.getById(run.id)).toMatchObject({
      id: run.id,
      status: 'running',
    });

    await queue.flush();

    const detail = await service.getRun(run.id);
    expect(detail.run.status).toBe('needs_review');
  });

  it('persists step progress while the workflow is running', async () => {
    const { service, runStore, queue } = makeService();

    const run = await service.start('intake-to-project-brief', {
      projectId: 'proj-1',
      input: { client: 'Acme' },
    });

    await queue.flush();

    const stored = await runStore.getById(run.id);
    expect(stored?.stepStatuses['compose-brief']).toBe('completed');
  });

  it('approves asynchronously and completes after flush', async () => {
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
});
