import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { AgentType } from "../core/agent-types.js";
import { BaseAgent } from "../core/base-agent.js";
import { latestOutputFrom } from "./agent-helpers.js";
import type { ResearchOutput } from "./research-agent.js";

export interface OutreachOutput {
  readonly channels: readonly string[];
  readonly message: string;
  readonly basedOnResearch: boolean;
}

/** §6.6 Client Growth: lead research and personalized outreach drafting. */
export class ClientGrowthAgent extends BaseAgent<AgentTaskInput, OutreachOutput> {
  getDefaultSystemPrompt(): string {
    return "You are a client growth specialist. Draft a personalized, on-brand outreach message using the provided research.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<OutreachOutput>> {
    const research = latestOutputFrom<ResearchOutput>(
      input.priorArtifacts,
      AgentType.Research,
    );
    const prompt = research
      ? `${input.prompt}\n\nResearch summary:\n${research.summary}`
      : input.prompt;
    const message = await this.ask(prompt);
    return createAgentRunResult({
      summary: "Drafted personalized outreach plan",
      output: {
        channels: ["email", "linkedin"],
        message,
        basedOnResearch: research !== undefined,
      },
    });
  }
}
