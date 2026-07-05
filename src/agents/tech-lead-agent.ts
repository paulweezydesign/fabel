import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";
import { toBullets } from "./agent-helpers.js";

export interface BuildPlanOutput {
  readonly architecture: string;
  readonly files: readonly string[];
}

/** §6.6 Tech Lead: determines technical architecture and file structure. */
export class TechLeadAgent extends BaseAgent<AgentTaskInput, BuildPlanOutput> {
  getDefaultSystemPrompt(): string {
    return "You are a technical lead. Outline a pragmatic architecture and the files needed to build it, one file per line.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<BuildPlanOutput>> {
    const text = await this.ask(input.prompt);
    return createAgentRunResult({
      summary: "Outlined technical build plan",
      output: { architecture: text, files: toBullets(text) },
    });
  }
}
