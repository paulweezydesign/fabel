import type { AgentContext } from './agent-context';
import type { AgentType } from './agent-types';
import { failureResult, type AgentRunResult } from './agent-result';
import type { AiClient } from '@/services/ai-client';
import type { Logger } from '@/services/logger';
import type { MessageBus } from '@/services/message-bus';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AgentServices {
  readonly ai: AiClient;
  readonly logger: Logger;
  readonly messageBus: MessageBus;
}

export interface BaseAgentInit {
  readonly id: string;
  readonly type: AgentType;
  readonly context: AgentContext;
  readonly services: AgentServices;
}

export type TaskInput = Record<string, unknown>;

/**
 * Common foundation for all specialized agents (FR-4, FR-5).
 * Subclasses override exactly two methods: getDefaultSystemPrompt() and
 * executeTask().
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly context: AgentContext;

  protected readonly ai: AiClient;
  protected readonly logger: Logger;
  protected readonly messageBus: MessageBus;

  #taskStatus: TaskStatus = 'pending';

  constructor({ id, type, context, services }: BaseAgentInit) {
    this.id = id;
    this.type = type;
    this.context = context;
    this.ai = services.ai;
    this.logger = services.logger;
    this.messageBus = services.messageBus;
  }

  get taskStatus(): TaskStatus {
    return this.#taskStatus;
  }

  abstract getDefaultSystemPrompt(): string;

  protected abstract executeTask(input: TaskInput): Promise<AgentRunResult>;

  /**
   * Runs the agent's task through the standard lifecycle:
   * pending → in_progress → completed | failed (AC-2, AC-3).
   * Errors are captured as failure results rather than escaping.
   */
  async assignTask(input: TaskInput): Promise<AgentRunResult> {
    if (this.#taskStatus !== 'pending') {
      throw new Error(
        `Agent ${this.id} cannot accept a task in status "${this.#taskStatus}"; a fresh agent must be pending.`,
      );
    }

    this.#taskStatus = 'in_progress';
    this.#publish('agent.task.started');
    this.logger.info(`agent ${this.type} started task`, { agentId: this.id });

    try {
      const result = await this.executeTask(input);
      this.#taskStatus = 'completed';
      this.#publish('agent.task.completed');
      this.logger.info(`agent ${this.type} completed task`, { agentId: this.id });
      return result;
    } catch (error) {
      this.#taskStatus = 'failed';
      this.#publish('agent.task.failed');
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`agent ${this.type} failed task`, {
        agentId: this.id,
        error: message,
      });
      return failureResult(`${this.type} agent failed: ${message}`);
    }
  }

  #publish(topic: string): void {
    this.messageBus.publish({
      topic,
      payload: { agentId: this.id, agentType: this.type },
    });
  }
}
