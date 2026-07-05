import { AgentFactory } from "./core/agent-factory.js";
import type { AgentServices } from "./core/agent-services.js";
import { InMemoryArtifactStore } from "./core/artifact-store.js";
import { WorkflowRunner } from "./core/workflow-runner.js";
import type { AiClient } from "./services/ai-client.js";
import { ConsoleLogger, type Logger } from "./services/logger.js";
import { selectAiClient } from "./services/openai-ai-client.js";
import { InMemoryMessageBus } from "./services/message-bus.js";

export interface App {
  readonly services: AgentServices;
  readonly factory: AgentFactory;
  readonly runner: WorkflowRunner;
}

export interface CreateAppOptions {
  /**
   * AI backend. Defaults to {@link selectAiClient}: a real `OpenAiClient` when
   * `OPENAI_API_KEY` is set, otherwise a `StubAiClient` so the platform runs
   * end-to-end without a provider key. Pass `aiClient` to override.
   */
  readonly aiClient?: AiClient;
  readonly logger?: Logger;
}

/** Composition root: wires the shared services, factory, and runner. */
export const createApp = (options: CreateAppOptions = {}): App => {
  const artifactStore = new InMemoryArtifactStore();
  const services: AgentServices = {
    aiClient: options.aiClient ?? selectAiClient(process.env),
    messageBus: new InMemoryMessageBus(),
    artifactStore,
    logger: options.logger ?? new ConsoleLogger(),
  };
  const factory = new AgentFactory(services);
  const runner = new WorkflowRunner(factory, artifactStore);
  return { services, factory, runner };
};
