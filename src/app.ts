import { AgentFactory } from "./core/agent-factory.js";
import type { AgentServices } from "./core/agent-services.js";
import { InMemoryArtifactStore } from "./core/artifact-store.js";
import { WorkflowRunner } from "./core/workflow-runner.js";
import { StubAiClient, type AiClient } from "./services/ai-client.js";
import { ConsoleLogger, type Logger } from "./services/logger.js";
import { InMemoryMessageBus } from "./services/message-bus.js";

export interface App {
  readonly services: AgentServices;
  readonly factory: AgentFactory;
  readonly runner: WorkflowRunner;
}

export interface CreateAppOptions {
  /**
   * AI backend. V1 leaves the provider undecided (PRD §10 #1); the default is a
   * {@link StubAiClient} so the platform runs end-to-end without a provider key.
   * Swap in a real adapter here when one is chosen.
   */
  readonly aiClient?: AiClient;
  readonly logger?: Logger;
}

/** Composition root: wires the shared services, factory, and runner. */
export const createApp = (options: CreateAppOptions = {}): App => {
  const artifactStore = new InMemoryArtifactStore();
  const services: AgentServices = {
    aiClient:
      options.aiClient ??
      new StubAiClient({
        responder: ({ prompt }) =>
          `Draft based on: "${prompt}".\n- Key point one\n- Key point two\n- Key point three`,
      }),
    messageBus: new InMemoryMessageBus(),
    artifactStore,
    logger: options.logger ?? new ConsoleLogger(),
  };
  const factory = new AgentFactory(services);
  const runner = new WorkflowRunner(factory, artifactStore);
  return { services, factory, runner };
};
