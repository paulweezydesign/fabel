import type { WorkflowService } from './workflow-service';
import { isWorkflowId } from '@/workflows/catalog';

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

interface StartParams {
  id: string;
}

interface RunParams {
  runId: string;
}

export const createWorkflowStartHandler =
  ({ service }: { service: WorkflowService }) =>
  async (request: Request, { id }: StartParams): Promise<Response> => {
    if (!isWorkflowId(id)) {
      return json(404, { error: `Unknown workflow "${id}".` });
    }

    let body: { projectId?: string; input?: Record<string, unknown> };
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: 'Request body must be valid JSON.' });
    }

    if (!body.projectId) {
      return json(400, { error: 'projectId is required.' });
    }

    try {
      const run = await service.start(id, {
        projectId: body.projectId,
        input: body.input ?? {},
      });
      return json(200, { run });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json(500, { error: message });
    }
  };

export const createWorkflowRunHandler =
  ({ service }: { service: WorkflowService }) =>
  async (_request: Request, { runId }: RunParams): Promise<Response> => {
    try {
      const detail = await service.getRun(runId);
      return json(200, detail);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        return json(404, { error: message });
      }
      return json(500, { error: message });
    }
  };

export const createWorkflowRunsListHandler =
  ({ service }: { service: WorkflowService }) =>
  async (_request: Request): Promise<Response> => {
    try {
      const runs = await service.listRuns();
      return json(200, { runs });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json(500, { error: message });
    }
  };

export const createWorkflowApproveHandler =
  ({ service }: { service: WorkflowService }) =>
  async (request: Request, { runId }: RunParams): Promise<Response> => {
    let body: { stepId?: string };
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: 'Request body must be valid JSON.' });
    }

    if (!body.stepId) {
      return json(400, { error: 'stepId is required.' });
    }

    try {
      const run = await service.approve(runId, body.stepId);
      return json(200, { run });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        return json(404, { error: message });
      }
      if (message.includes('not awaiting review')) {
        return json(409, { error: message });
      }
      return json(500, { error: message });
    }
  };
