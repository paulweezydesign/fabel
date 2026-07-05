/** Success/failure indicator for an agent run (FR-3). */
export type AgentRunStatus = "success" | "failure";

/**
 * FR-3: The uniform result every agent returns.
 *
 * The workflow runner consumes this shape without any agent-specific logic, so
 * the structure is identical across all agent types. `output` carries the
 * agent-specific structured payload.
 */
export interface AgentRunResult<TOutput = unknown> {
  readonly status: AgentRunStatus;
  readonly summary: string;
  readonly output: TOutput;
  readonly questions: readonly string[];
  readonly risks: readonly string[];
}

interface BuildResultInput<TOutput> {
  readonly status?: AgentRunStatus;
  readonly summary: string;
  readonly output: TOutput;
  readonly questions?: readonly string[];
  readonly risks?: readonly string[];
}

/** Convenience builder that fills the optional collections with empty arrays. */
export const createAgentRunResult = <TOutput>(
  input: BuildResultInput<TOutput>,
): AgentRunResult<TOutput> =>
  Object.freeze({
    status: input.status ?? "success",
    summary: input.summary,
    output: input.output,
    questions: Object.freeze([...(input.questions ?? [])]),
    risks: Object.freeze([...(input.risks ?? [])]),
  });

/** Builds a failure result from an error (used by BaseAgent on task errors). */
export const createFailureResult = (
  error: unknown,
): AgentRunResult<{ readonly error: string }> => {
  const message = error instanceof Error ? error.message : String(error);
  return createAgentRunResult({
    status: "failure",
    summary: `Task failed: ${message}`,
    output: { error: message },
  });
};

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * Validates that an unknown value conforms to {@link AgentRunResult}.
 *
 * Used at the runner boundary (§8) so malformed agent output is treated as a
 * step failure rather than propagating an invalid shape downstream.
 */
export const isAgentRunResult = (
  value: unknown,
): value is AgentRunResult => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.status === "success" || candidate.status === "failure") &&
    typeof candidate.summary === "string" &&
    "output" in candidate &&
    isStringArray(candidate.questions) &&
    isStringArray(candidate.risks)
  );
};
