import { describe, expect, it, vi } from 'vitest';
import { createWorkflowClient, WorkflowClientError } from './workflow-client';
import type { WorkflowRunSnapshot } from '@/core/workflow-runner';

const sampleRun = (overrides: Partial<WorkflowRunSnapshot> = {}): WorkflowRunSnapshot => ({
  id: 'run-1',
  definitionId: 'lead-to-outreach',
  projectId: 'proj-1',
  status: 'needs_review',
  startedAt: '2026-07-05T10:00:00.000Z',
  pendingApprovalStepId: 'draft-outreach',
  error: null,
  stepStatuses: {
    'research-prospect': 'completed',
    'draft-outreach': 'completed',
  },
  approvedStepIds: [],
  workflowInput: { leadName: 'Acme' },
  createdAt: '2026-07-05T10:00:00.000Z',
  updatedAt: '2026-07-05T10:01:00.000Z',
  ...overrides,
});

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createWorkflowClient', () => {
  it('starts a workflow via POST /api/workflows/:id/run', async () => {
    const run = sampleRun();
    const fetchMock = vi.fn(async () => jsonResponse({ run }));

    const client = createWorkflowClient(fetchMock);
    const result = await client.start('lead-to-outreach', {
      projectId: 'proj-1',
      input: { leadName: 'Acme' },
    });

    expect(result).toEqual(run);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/workflows/lead-to-outreach/run');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: 'proj-1',
      input: { leadName: 'Acme' },
    });
  });

  it('lists runs via GET /api/workflows/runs', async () => {
    const runs = [
      {
        id: 'run-2',
        definitionId: 'intake-to-project-brief',
        projectId: 'proj-2',
        status: 'completed',
        startedAt: '2026-07-05T11:00:00.000Z',
        updatedAt: '2026-07-05T11:05:00.000Z',
      },
      {
        id: 'run-1',
        definitionId: 'lead-to-outreach',
        projectId: 'proj-1',
        status: 'needs_review',
        startedAt: '2026-07-05T10:00:00.000Z',
        updatedAt: '2026-07-05T10:01:00.000Z',
      },
    ];
    const fetchMock = vi.fn(async () => jsonResponse({ runs }));

    const client = createWorkflowClient(fetchMock);
    const result = await client.listRuns();

    expect(result).toEqual(runs);
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
    expect(url).toBe('/api/workflows/runs');
  });

  it('fetches run detail via GET /api/workflows/runs/:runId', async () => {
    const detail = { run: sampleRun(), artifacts: [{ id: 'a-1', title: 'Research' }] };
    const fetchMock = vi.fn(async () => jsonResponse(detail));

    const client = createWorkflowClient(fetchMock);
    const result = await client.getRun('run-1');

    expect(result).toEqual(detail);
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
    expect(url).toBe('/api/workflows/runs/run-1');
  });

  it('approves a paused step via POST /api/workflows/runs/:runId/approve', async () => {
    const run = sampleRun({ status: 'completed', pendingApprovalStepId: null });
    const fetchMock = vi.fn(async () => jsonResponse({ run }));

    const client = createWorkflowClient(fetchMock);
    const result = await client.approve('run-1', 'draft-outreach');

    expect(result).toEqual(run);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/workflows/runs/run-1/approve');
    expect(JSON.parse(init.body as string)).toEqual({ stepId: 'draft-outreach' });
  });

  it('surfaces non-2xx responses as WorkflowClientError', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: 'Unknown workflow "nope".' }, 404),
    );

    const client = createWorkflowClient(fetchMock);

    await expect(
      client.start('lead-to-outreach', { projectId: 'p', input: {} }),
    ).rejects.toMatchObject({
      name: 'WorkflowClientError',
      status: 404,
      message: expect.stringContaining('nope'),
    });
  });
});

describe('WorkflowClientError', () => {
  it('carries the HTTP status', () => {
    const error = new WorkflowClientError(409, 'not awaiting review');
    expect(error.status).toBe(409);
    expect(error.name).toBe('WorkflowClientError');
  });
});
