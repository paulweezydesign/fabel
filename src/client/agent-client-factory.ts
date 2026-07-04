import { isAgentType, type AgentType } from '@/core/agent-types';
import type { AgentRunResult } from '@/core/agent-result';
import type { TaskInput } from '@/core/base-agent';

/**
 * Browser-safe access to agents (FR-16). All execution happens server-side
 * behind /api/agents/:type/run, so no AI credentials ever reach the client
 * (FR-15).
 */
export interface AgentClient {
  run(input: TaskInput): Promise<AgentRunResult>;
}

export class AgentClientError extends Error {
  readonly name = 'AgentClientError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export const createAgentClient = (
  type: AgentType,
  fetchImpl: FetchImpl = fetch,
): AgentClient => {
  if (!isAgentType(type)) {
    throw new Error(`"${type}" is not a valid agent type.`);
  }

  return {
    run: async (input) => {
      const response = await fetchImpl(`/api/agents/${type}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const fallback = `Agent "${type}" request failed with status ${response.status}.`;
        const message = await response
          .json()
          .then((payload: { error?: string }) => payload.error ?? fallback)
          .catch(() => fallback);
        throw new AgentClientError(response.status, message);
      }

      return (await response.json()) as AgentRunResult;
    },
  };
};
