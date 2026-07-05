import type { Artifact } from '@/core/artifact-store';
import type { WorkflowRunSnapshot } from '@/core/workflow-runner';
import type { TaskInput } from '@/core/base-agent';
import type { WorkflowId } from '@/workflows/catalog';

export interface WorkflowRunDetail {
  readonly run: WorkflowRunSnapshot;
  readonly artifacts: readonly Artifact[];
}

export interface WorkflowClient {
  start(
    workflowId: WorkflowId,
    options: { projectId: string; input: TaskInput },
  ): Promise<WorkflowRunSnapshot>;
  getRun(runId: string): Promise<WorkflowRunDetail>;
  approve(runId: string, stepId: string): Promise<WorkflowRunSnapshot>;
}

export class WorkflowClientError extends Error {
  readonly name = 'WorkflowClientError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

const readError = async (response: Response, fallback: string): Promise<string> =>
  response
    .json()
    .then((payload: { error?: string }) => payload.error ?? fallback)
    .catch(() => fallback);

export const createWorkflowClient = (fetchImpl: FetchImpl = fetch): WorkflowClient => ({
  start: async (workflowId, { projectId, input }) => {
    const response = await fetchImpl(`/api/workflows/${workflowId}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, input }),
    });
    if (!response.ok) {
      throw new WorkflowClientError(
        response.status,
        await readError(response, `Workflow start failed with status ${response.status}.`),
      );
    }
    const payload = (await response.json()) as { run: WorkflowRunSnapshot };
    return payload.run;
  },

  getRun: async (runId) => {
    const response = await fetchImpl(`/api/workflows/runs/${runId}`);
    if (!response.ok) {
      throw new WorkflowClientError(
        response.status,
        await readError(response, `Workflow run fetch failed with status ${response.status}.`),
      );
    }
    return (await response.json()) as WorkflowRunDetail;
  },

  approve: async (runId, stepId) => {
    const response = await fetchImpl(`/api/workflows/runs/${runId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stepId }),
    });
    if (!response.ok) {
      throw new WorkflowClientError(
        response.status,
        await readError(response, `Workflow approve failed with status ${response.status}.`),
      );
    }
    const payload = (await response.json()) as { run: WorkflowRunSnapshot };
    return payload.run;
  },
});
