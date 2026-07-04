/**
 * Messaging hooks between agents (FR-4). V1 workflows are strictly
 * sequential, so the bus is used for observability events; richer
 * agent-to-agent messaging is a future enhancement.
 */
export interface BusMessage {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

export type Unsubscribe = () => void;

export interface MessageBus {
  publish(message: BusMessage): void;
  subscribe(topic: string, handler: (message: BusMessage) => void): Unsubscribe;
}

export const createInMemoryMessageBus = (): MessageBus => {
  const subscribers = new Map<string, Set<(message: BusMessage) => void>>();
  return {
    publish: (message) => {
      subscribers.get(message.topic)?.forEach((handler) => handler(message));
    },
    subscribe: (topic, handler) => {
      const handlers = subscribers.get(topic) ?? new Set();
      handlers.add(handler);
      subscribers.set(topic, handlers);
      return () => handlers.delete(handler);
    },
  };
};
