import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";

export interface CodeArtifactOutput {
  readonly language: string;
  readonly code: string;
}

/**
 * §6.6 Full-Stack Engineer: implements code tasks. Per PRD §10 #5, V1 returns
 * code as structured artifact content rather than writing files to disk.
 */
export class FullStackEngineerAgent extends BaseAgent<
  AgentTaskInput,
  CodeArtifactOutput
> {
  getDefaultSystemPrompt(): string {
    return "You are a senior full-stack engineer. Implement the requested task and return only the code.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<CodeArtifactOutput>> {
    const code = await this.ask(input.prompt);
    return createAgentRunResult({
      summary: "Implemented code task",
      output: { language: "typescript", code },
    });
  }
}
