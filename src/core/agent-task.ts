import type { Artifact } from "./artifact-store.js";

/**
 * Uniform input the {@link WorkflowRunner} passes to every agent's
 * `assignTask()`. Keeping it uniform lets the runner drive any agent without
 * agent-specific logic (FR-3, FR-10).
 */
export interface AgentTaskInput {
  /** The instruction for this step. */
  readonly prompt: string;
  /** The initial input supplied when the workflow was started. */
  readonly workflowInput?: unknown;
  /** Artifacts produced by already-completed steps, in save order. */
  readonly priorArtifacts: readonly Artifact[];
}
