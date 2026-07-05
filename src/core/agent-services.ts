import type { AiClient } from "../services/ai-client.js";
import type { Logger } from "../services/logger.js";
import type { MessageBus } from "../services/message-bus.js";
import type { ArtifactStore } from "./artifact-store.js";

/**
 * The shared services the factory injects into every agent (FR-6). Bundling
 * them keeps agent constructors uniform and free of service wiring.
 */
export interface AgentServices {
  readonly aiClient: AiClient;
  readonly messageBus: MessageBus;
  readonly artifactStore: ArtifactStore;
  readonly logger: Logger;
}
