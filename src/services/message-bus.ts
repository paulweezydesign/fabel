import type { AgentType } from "../core/agent-types.js";

/**
 * Messaging hooks between agents (FR-4, §6.6). V1 workflows are strictly
 * sequential, so the bus is an observable no-op used for logging/observability
 * (PRD §10 #3): agents may publish events, but nothing depends on delivery.
 */
export interface AgentMessage {
  readonly from: AgentType;
  readonly type: string;
  readonly payload?: unknown;
  readonly at: string;
}

export interface MessageBus {
  publish(message: Omit<AgentMessage, "at">): void;
}

/** In-memory bus that records published messages so tests can assert on them. */
export class InMemoryMessageBus implements MessageBus {
  private readonly log: AgentMessage[] = [];

  publish(message: Omit<AgentMessage, "at">): void {
    this.log.push({ ...message, at: new Date().toISOString() });
  }

  get messages(): readonly AgentMessage[] {
    return this.log;
  }
}
