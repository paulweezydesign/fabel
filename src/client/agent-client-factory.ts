import type { AgentRunResult } from "../core/agent-result.js";
import type { AgentTaskInput } from "../core/agent-task.js";
import type { AgentType } from "../core/agent-types.js";

/** Structured error surfaced when the API returns a non-2xx response (AC-15). */
export class AgentClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "AgentClientError";
  }
}

export interface AgentClient {
  run(input: AgentTaskInput): Promise<AgentRunResult>;
}

export interface CreateAgentClientOptions {
  readonly baseUrl?: string;
  /** Injectable fetch, primarily for tests; defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * FR-16: browser-safe wrapper exposing a uniform `run()` per agent type. It
 * only posts to `/api/agents/:type/run`; credentials never live client-side.
 */
export const createAgentClient = (
  type: AgentType,
  options: CreateAgentClientOptions = {},
): AgentClient => {
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  const doFetch = options.fetchImpl ?? fetch;

  return {
    async run(input: AgentTaskInput): Promise<AgentRunResult> {
      const response = await doFetch(`${baseUrl}/api/agents/${type}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload: unknown = await response
        .json()
        .catch(() => undefined);

      if (!response.ok) {
        const message =
          (payload as { error?: string } | undefined)?.error ??
          response.statusText ??
          `Request failed with status ${response.status}`;
        throw new AgentClientError(response.status, message, payload);
      }
      return payload as AgentRunResult;
    },
  };
};
