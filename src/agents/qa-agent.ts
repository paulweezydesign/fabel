import type { AgentTaskInput } from "../core/agent-task.js";
import { createAgentRunResult, type AgentRunResult } from "../core/agent-result.js";
import { BaseAgent } from "../core/base-agent.js";
import { toBullets } from "./agent-helpers.js";

export interface QaChecklistOutput {
  readonly acceptanceCriteria: readonly string[];
  readonly checklist: readonly string[];
}

/** §6.6 QA: defines acceptance criteria and a QA checklist. */
export class QaAgent extends BaseAgent<AgentTaskInput, QaChecklistOutput> {
  getDefaultSystemPrompt(): string {
    return "You are a QA engineer. Produce acceptance criteria and a concrete QA checklist, one item per line.";
  }

  protected async executeTask(
    input: AgentTaskInput,
  ): Promise<AgentRunResult<QaChecklistOutput>> {
    const text = await this.ask(input.prompt);
    const items = toBullets(text);
    return createAgentRunResult({
      summary: "Created QA checklist",
      output: { acceptanceCriteria: items, checklist: items },
      ...(items.length === 0
        ? { risks: ["No QA items generated; acceptance criteria may be incomplete."] }
        : {}),
    });
  }
}
