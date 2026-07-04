import { createAgentRunHandler } from '@/server/agent-run-handler';
import { getServerServices } from '@/server/services';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
): Promise<Response> {
  const { type } = await params;
  const handler = createAgentRunHandler(getServerServices());
  return handler(request, { type });
}
