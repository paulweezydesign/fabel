import type { AgentServices } from "../core/agent-services.js";
import { InMemoryArtifactStore } from "../core/artifact-store.js";
import { StubAiClient, type StubAiClientOptions } from "../services/ai-client.js";
import { MemoryLogger } from "../services/logger.js";
import { InMemoryMessageBus } from "../services/message-bus.js";

export interface TestServices extends AgentServices {
  readonly aiClient: StubAiClient;
  readonly messageBus: InMemoryMessageBus;
  readonly artifactStore: InMemoryArtifactStore;
  readonly logger: MemoryLogger;
}

/**
 * Builds a fully in-memory {@link AgentServices} bundle for tests, with a
 * stubbed {@link StubAiClient} so no test touches the network (§9).
 */
export const makeTestServices = (
  aiOptions?: StubAiClientOptions,
): TestServices => ({
  aiClient: new StubAiClient(aiOptions),
  messageBus: new InMemoryMessageBus(),
  artifactStore: new InMemoryArtifactStore(),
  logger: new MemoryLogger(),
});
