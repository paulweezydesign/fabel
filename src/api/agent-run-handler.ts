import { createAgentContext, type AgentContext } from "../core/agent-context.js";
import type { AgentFactory } from "../core/agent-factory.js";
import type { Artifact } from "../core/artifact-store.js";
import { isAgentType } from "../core/agent-types.js";

/** Body accepted by `POST /api/agents/:type/run`. */
export interface AgentRunRequestBody {
  readonly prompt: string;
  readonly context?: AgentContext;
  readonly workflowInput?: unknown;
  readonly priorArtifacts?: readonly Artifact[];
}

export interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

export interface AgentRunDeps {
  readonly factory: AgentFactory;
}

const isValidBody = (value: unknown): value is AgentRunRequestBody =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { prompt?: unknown }).prompt === "string";

/**
 * FR-15: framework-agnostic handler for a single agent run. All execution is
 * server-side; no provider credentials appear in the request or response.
 * Unknown agent types return 404 with a structured error (§8, AC-15).
 */
export const handleAgentRun = async (
  typeParam: string,
  body: unknown,
  deps: AgentRunDeps,
): Promise<HttpResult> => {
  if (!isAgentType(typeParam)) {
    return {
      status: 404,
      body: { error: `Unknown agent type: ${typeParam}` },
    };
  }
  if (!isValidBody(body)) {
    return {
      status: 400,
      body: { error: "Invalid request body: 'prompt' (string) is required" },
    };
  }

  try {
    const agent = deps.factory.createAgent(
      typeParam,
      body.context ?? createAgentContext(),
    );
    const result = await agent.assignTask({
      prompt: body.prompt,
      workflowInput: body.workflowInput,
      priorArtifacts: body.priorArtifacts ?? [],
    });
    return { status: result.status === "success" ? 200 : 422, body: result };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
};
