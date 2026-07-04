/**
 * Uniform result shape returned by every agent (FR-3), letting the workflow
 * runner handle results without agent-specific logic.
 */
export type AgentRunStatus = 'success' | 'failure';

export interface AgentRunResult<TOutput = unknown> {
  readonly status: AgentRunStatus;
  readonly summary: string;
  readonly output: TOutput;
  readonly questions: readonly string[];
  readonly risks: readonly string[];
}

interface SuccessResultInput<TOutput> {
  summary: string;
  output: TOutput;
  questions?: readonly string[];
  risks?: readonly string[];
}

export const successResult = <TOutput>({
  summary,
  output,
  questions = [],
  risks = [],
}: SuccessResultInput<TOutput>): AgentRunResult<TOutput> => ({
  status: 'success',
  summary,
  output,
  questions,
  risks,
});

export const failureResult = (summary: string): AgentRunResult<null> => ({
  status: 'failure',
  summary,
  output: null,
  questions: [],
  risks: [],
});

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isAgentRunResult = (value: unknown): value is AgentRunResult => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.status === 'success' || candidate.status === 'failure') &&
    typeof candidate.summary === 'string' &&
    'output' in candidate &&
    isStringArray(candidate.questions) &&
    isStringArray(candidate.risks)
  );
};
