import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";
import { toBullets } from "./agent-helpers.js";

export interface ProjectPlanOutput {
  readonly milestones: readonly string[];
  readonly blockers: readonly string[];
  readonly brief: string;
}

/** §6.6 Project Manager: clarifies goals, breaks work into milestones. */
export class ProjectManagerAgent extends BaseAgent<
  AgentTaskInput,
  ProjectPlanOutput
> {
  getDefaultSystemPrompt(): string {
    return "You are a pragmatic project manager. Clarify client goals, break work into milestones, and flag blockers.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<ProjectPlanOutput>> {
    const text = await this.ask(input.prompt);
    const milestones = toBullets(text);
    return createAgentRunResult({
      summary: "Composed project brief and milestones",
      output: {
        milestones,
        blockers: [],
        brief: text,
      },
    });
  }
}
