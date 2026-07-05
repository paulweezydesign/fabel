import type { AgentContext } from "./agent-context.js";
import { createFailureResult, type AgentRunResult } from "./agent-result.js";
import type { AgentServices } from "./agent-services.js";
import type { AgentType } from "./agent-types.js";

/** FR-4: task lifecycle states. */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

const ALLOWED_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> =
  Object.freeze({
    pending: ["in_progress"],
    in_progress: ["completed", "failed"],
    completed: [],
    failed: [],
  });

export interface BaseAgentParams {
  readonly id: string;
  readonly type: AgentType;
  readonly context: AgentContext;
  readonly services: AgentServices;
}

/**
 * FR-4/FR-5: abstract base for every agent.
 *
 * Provides identity, task-lifecycle management, injected AI access, and
 * logging/messaging hooks. Subclasses override exactly two methods:
 * {@link getDefaultSystemPrompt} and {@link executeTask}.
 */
export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly type: AgentType;
  protected readonly context: AgentContext;
  protected readonly services: AgentServices;
  private taskStatus: TaskStatus = "pending";

  constructor(params: BaseAgentParams) {
    this.id = params.id;
    this.type = params.type;
    this.context = params.context;
    this.services = params.services;
  }

  get status(): TaskStatus {
    return this.taskStatus;
  }

  /** FR-5: system prompt shaping the model's behaviour for this agent. */
  abstract getDefaultSystemPrompt(): string;

  /** FR-5: performs the work and returns a structured {@link AgentRunResult}. */
  protected abstract executeTask(
    input: TInput,
  ): Promise<AgentRunResult<TOutput>>;

  /**
   * Runs the task through the lifecycle. A thrown error is converted to a
   * failure result and never escapes unhandled (AC-3).
   */
  async assignTask(input: TInput): Promise<AgentRunResult> {
    this.transition("in_progress");
    this.services.logger.info("agent.task.started", {
      agentId: this.id,
      agentType: this.type,
    });
    try {
      const result = await this.executeTask(input);
      this.transition(result.status === "success" ? "completed" : "failed");
      this.services.messageBus.publish({
        from: this.type,
        type: `agent.task.${result.status}`,
      });
      return result;
    } catch (error) {
      this.transition("failed");
      this.services.logger.error("agent.task.errored", {
        agentId: this.id,
        agentType: this.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return createFailureResult(error);
    }
  }

  /**
   * FR-4: the only path to the AI provider. Uses the injected client and this
   * agent's default system prompt; agents never hold provider keys.
   */
  protected async ask(prompt: string): Promise<string> {
    const response = await this.services.aiClient.complete({
      systemPrompt: this.getDefaultSystemPrompt(),
      prompt,
    });
    return response.text;
  }

  private transition(next: TaskStatus): void {
    if (!ALLOWED_TRANSITIONS[this.taskStatus].includes(next)) {
      throw new Error(
        `Invalid task transition for agent ${this.id}: ${this.taskStatus} -> ${next}`,
      );
    }
    this.taskStatus = next;
  }
}
