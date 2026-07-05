import { createWorkflowStartHandler } from '@/server/workflow-handlers';
import { getServerServices } from '@/server/services';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { workflowService } = getServerServices();
  const handler = createWorkflowStartHandler({ service: workflowService });
  return handler(request, { id });
}
