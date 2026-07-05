import { createWorkflowRunHandler } from '@/server/workflow-handlers';
import { getServerServices } from '@/server/services';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const { workflowService } = getServerServices();
  const handler = createWorkflowRunHandler({ service: workflowService });
  return handler(request, { runId });
}
