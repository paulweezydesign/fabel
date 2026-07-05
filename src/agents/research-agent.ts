import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";
import { toBullets } from "./agent-helpers.js";

export interface ResearchOutput {
  readonly subject: string;
  readonly summary: string;
  readonly facts: readonly string[];
}

/** §6.6 Research: retrieval-style research returning cited facts. */
export class ResearchAgent extends BaseAgent<AgentTaskInput, ResearchOutput> {
  getDefaultSystemPrompt(): string {
    return "You are a diligent research analyst. Summarize the subject and list concise, verifiable facts, one per line.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<ResearchOutput>> {
    const text = await this.ask(input.prompt);
    const facts = toBullets(text);
    return createAgentRunResult({
      summary: `Researched: ${input.prompt}`,
      output: { subject: input.prompt, summary: text, facts },
      ...(facts.length === 0 ? { questions: ["No facts found; provide more detail on the subject?"] } : {}),
    });
  }
}
