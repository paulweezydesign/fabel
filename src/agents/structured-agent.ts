import { BaseAgent, type TaskInput } from '@/core/base-agent';
import { successResult, type AgentRunResult } from '@/core/agent-result';
import { extractJsonObject } from './structured-output';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Shared execution shape for all V1 agents (§6.6): send the role-specific
 * system prompt plus the task input, expect a JSON object back, and lift
 * summary/questions/risks into the uniform AgentRunResult.
 */
export abstract class StructuredAgent extends BaseAgent {
  protected async executeTask(input: TaskInput): Promise<AgentRunResult> {
    const reply = await this.ai.complete([
      { role: 'system', content: this.getDefaultSystemPrompt() },
      { role: 'user', content: this.buildUserPrompt(input) },
    ]);

    const parsed = extractJsonObject(reply);
    const { summary, questions, risks, ...output } = parsed;

    return successResult({
      summary: typeof summary === 'string' ? summary : `${this.type} task completed`,
      output,
      questions: asStringArray(questions),
      risks: asStringArray(risks),
    });
  }

  protected buildUserPrompt(input: TaskInput): string {
    const { workflowInput, priorArtifacts, stepTitle } = input;
    const sections = [
      stepTitle ? `Task: ${stepTitle}` : null,
      `Input:\n${JSON.stringify(workflowInput ?? {}, null, 2)}`,
      Array.isArray(priorArtifacts) && priorArtifacts.length > 0
        ? `Prior work from other agents:\n${JSON.stringify(priorArtifacts, null, 2)}`
        : null,
      'Respond with a single JSON object only.',
    ];
    return sections.filter(Boolean).join('\n\n');
  }
}

export const JSON_CONTRACT = `Always respond with a single JSON object and nothing else.
The object must include a "summary" string describing what you did, and may
include "questions" (array of strings needing human input) and "risks"
(array of strings). Add your domain-specific fields alongside these.`;
