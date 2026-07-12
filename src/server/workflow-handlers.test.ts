import { describe, expect, it } from 'vitest';
import {
  createWorkflowApproveHandler,
  createWorkflowRunHandler,
  createWorkflowRunsListHandler,
  createWorkflowStartHandler,
} from './workflow-handlers';
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

const makeHandlers = () => {
  const logger = createRecordingLogger();
  const queue = createDeferredTaskQueue();
  const service = createWorkflowService({
    runStore: createInMemoryWorkflowRunStore(),
    artifactStore: createInMemoryArtifactStore(),
    factory: createAgentFactory({
      registry: defaultAgentRegistry,
      services: {
        ai: createStubAiClient(() =>
          JSON.stringify({ summary: 'stubbed', detail: 'ok' }),
        ),
        logger,
        messageBus: createRecordingMessageBus(),
      },
    }),
    logger,
    schedule: queue.schedule,
  });

  return {
    start: createWorkflowStartHandler({ service }),
    get: createWorkflowRunHandler({ service }),
    list: createWorkflowRunsListHandler({ service }),
    approve: createWorkflowApproveHandler({ service }),
    queue,
  };
};

describe('workflow API handlers', () => {
  it('POST /api/workflows/:id/run returns running immediately (async execution)', async () => {
    const { start, get, queue } = makeHandlers();
    const response = await start(
      new Request('http://test/api/workflows/lead-to-outreach/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 'proj-1',
          input: { leadName: 'Acme' },
        }),
      }),
      { id: 'lead-to-outreach' },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.run.status).toBe('running');
    expect(payload.run.definitionId).toBe('lead-to-outreach');

    await queue.flush();

    const detail = await (
      await get(new Request('http://test'), { runId: payload.run.id })
    ).json();
    expect(detail.run.status).toBe('needs_review');
  });

  it('GET /api/workflows/runs/:runId returns run detail and artifacts', async () => {
    const handlers = makeHandlers();
    const started = await (
      await handlers.start(
        new Request('http://test/api/workflows/lead-to-outreach/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: 'proj-1', input: {} }),
        }),
        { id: 'lead-to-outreach' },
      )
    ).json();
    await handlers.queue.flush();

    const response = await handlers.get(new Request('http://test'), {
      runId: started.run.id,
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.run.id).toBe(started.run.id);
    expect(payload.artifacts.length).toBeGreaterThan(0);
  });

  it('POST /api/workflows/runs/:runId/approve resumes a paused workflow', async () => {
    const handlers = makeHandlers();
    const started = await (
      await handlers.start(
        new Request('http://test/api/workflows/lead-to-outreach/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: 'proj-1', input: {} }),
        }),
        { id: 'lead-to-outreach' },
      )
    ).json();
    await handlers.queue.flush();

    const paused = await (
      await handlers.get(new Request('http://test'), { runId: started.run.id })
    ).json();

    const response = await handlers.approve(
      new Request('http://test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepId: paused.run.pendingApprovalStepId }),
      }),
      { runId: started.run.id },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.run.status).toBe('running');

    await handlers.queue.flush();

    const completed = await (
      await handlers.get(new Request('http://test'), { runId: started.run.id })
    ).json();
    expect(completed.run.status).toBe('completed');
  });

  it('returns 404 for an unknown workflow id', async () => {
    const { start } = makeHandlers();
    const response = await start(
      new Request('http://test/api/workflows/nope/run', { method: 'POST', body: '{}' }),
      { id: 'nope' },
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/nope/);
  });

  it('returns 404 for an unknown run id', async () => {
    const { get } = makeHandlers();
    const response = await get(new Request('http://test'), { runId: 'missing' });
    expect(response.status).toBe(404);
  });

  it('GET /api/workflows/runs lists all runs with summary fields', async () => {
    const handlers = makeHandlers();
    const started = await (
      await handlers.start(
        new Request('http://test/api/workflows/lead-to-outreach/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: 'proj-1', input: {} }),
        }),
        { id: 'lead-to-outreach' },
      )
    ).json();
    await handlers.queue.flush();

    const response = await handlers.list(new Request('http://test'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.runs).toHaveLength(1);
    expect(payload.runs[0]).toEqual({
      id: started.run.id,
      definitionId: 'lead-to-outreach',
      projectId: 'proj-1',
      status: 'needs_review',
      startedAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns 400 when approve body omits stepId', async () => {
    const handlers = makeHandlers();
    const started = await (
      await handlers.start(
        new Request('http://test/api/workflows/lead-to-outreach/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: 'proj-1', input: {} }),
        }),
        { id: 'lead-to-outreach' },
      )
    ).json();
    await handlers.queue.flush();

    const response = await handlers.approve(
      new Request('http://test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      { runId: started.run.id },
    );

    expect(response.status).toBe(400);
  });
});
