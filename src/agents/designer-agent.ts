import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";

export interface DesignDirectionOutput {
  readonly direction: string;
  readonly palette: readonly string[];
}

/** §6.6 Designer: generates brand and layout direction from business context. */
export class DesignerAgent extends BaseAgent<
  AgentTaskInput,
  DesignDirectionOutput
> {
  getDefaultSystemPrompt(): string {
    return "You are a brand designer. Propose a cohesive visual direction and a small colour palette.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<DesignDirectionOutput>> {
    const direction = await this.ask(input.prompt);
    return createAgentRunResult({
      summary: "Proposed visual direction",
      output: {
        direction,
        palette: ["#0F172A", "#2563EB", "#F8FAFC"],
      },
    });
  }
}
