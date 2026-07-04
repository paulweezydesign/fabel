import type { AiClient, AiMessage } from '@/services/ai-client';
import type { Logger, LogEntry } from '@/services/logger';
import type { MessageBus, BusMessage } from '@/services/message-bus';

/**
 * Test doubles shared across suites (AC-4: no network in unit tests).
 */

export interface StubAiClient extends AiClient {
  readonly calls: { messages: AiMessage[] }[];
}

export const createStubAiClient = (
  respond: (messages: readonly AiMessage[]) => string = () => '{}',
): StubAiClient => {
  const calls: { messages: AiMessage[] }[] = [];
  return {
    calls,
    complete: async (messages) => {
      calls.push({ messages: [...messages] });
      return respond(messages);
    },
  };
};

export const createFailingAiClient = (message = 'provider unavailable'): AiClient => ({
  complete: async () => {
    throw new Error(message);
  },
});

export interface RecordingLogger extends Logger {
  readonly entries: LogEntry[];
}

export const createRecordingLogger = (): RecordingLogger => {
  const entries: LogEntry[] = [];
  const record =
    (level: LogEntry['level']) =>
    (message: string, data?: Record<string, unknown>) => {
      entries.push({ level, message, data });
    };
  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
};

export interface RecordingMessageBus extends MessageBus {
  readonly published: BusMessage[];
}

export const createRecordingMessageBus = (): RecordingMessageBus => {
  const published: BusMessage[] = [];
  const subscribers = new Map<string, ((message: BusMessage) => void)[]>();
  return {
    published,
    publish: (message) => {
      published.push(message);
      (subscribers.get(message.topic) ?? []).forEach((handler) => handler(message));
    },
    subscribe: (topic, handler) => {
      subscribers.set(topic, [...(subscribers.get(topic) ?? []), handler]);
      return () => {
        subscribers.set(
          topic,
          (subscribers.get(topic) ?? []).filter((h) => h !== handler),
        );
      };
    },
  };
};
