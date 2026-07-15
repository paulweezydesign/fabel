import { createWorkflowEditHandler } from '@/server/workflow-handlers';
import { getServerServices } from '@/server/services';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const { workflowService } = getServerServices();
  const handler = createWorkflowEditHandler({ service: workflowService });
  return handler(request, { runId });
}
