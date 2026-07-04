import type { AgentFactory } from '@/core/agent-factory';
import { createAgentContext } from '@/core/agent-context';
import { isAgentType } from '@/core/agent-types';
import type { TaskInput } from '@/core/base-agent';
import type { Logger } from '@/services/logger';

interface HandlerInit {
  factory: AgentFactory;
  logger: Logger;
}

interface RouteParams {
  type: string;
}

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Server-side execution boundary for POST /api/agents/:type/run (FR-15).
 * Task failures are returned as failure AgentRunResults with a 200 —
 * transport-level errors (unknown type, bad request) get error statuses.
 */
export const createAgentRunHandler =
  ({ factory, logger }: HandlerInit) =>
  async (request: Request, { type }: RouteParams): Promise<Response> => {
    if (!isAgentType(type)) {
      return json(404, { error: `Unknown agent type "${type}".` });
    }

    let body: { input?: TaskInput; context?: Record<string, string> };
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: 'Request body must be valid JSON.' });
    }

    try {
      const agent = factory.createAgent(type, createAgentContext(body.context ?? {}));
      const result = await agent.assignTask(body.input ?? {});
      return json(200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('agent run failed', { type, error: message });
      return json(500, { error: message });
    }
  };
