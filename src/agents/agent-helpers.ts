import type { Artifact } from "../core/artifact-store.js";
import type { AgentType } from "../core/agent-types.js";

/** Splits model text into trimmed, non-empty bullet lines (leading markers removed). */
export const toBullets = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.replace(/^[\s*\-•\d.)]+/, "").trim())
    .filter((line) => line.length > 0);

/** Returns the content of the most recent artifact produced by `agentType`. */
export const latestOutputFrom = <T = unknown>(
  artifacts: readonly Artifact[],
  agentType: AgentType,
): T | undefined => {
  for (let i = artifacts.length - 1; i >= 0; i -= 1) {
    const artifact = artifacts[i];
    if (artifact && artifact.agentType === agentType) {
      return artifact.content as T;
    }
  }
  return undefined;
};
