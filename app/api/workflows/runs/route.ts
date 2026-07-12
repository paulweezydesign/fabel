import { createWorkflowRunsListHandler } from '@/server/workflow-handlers';
import { getServerServices } from '@/server/services';

export async function GET(request: Request): Promise<Response> {
  const { workflowService } = getServerServices();
  const handler = createWorkflowRunsListHandler({ service: workflowService });
  return handler(request);
}
