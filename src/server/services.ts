import { createAgentFactory, type AgentFactory } from '@/core/agent-factory';
import { defaultAgentRegistry } from '@/agents/registry';
import { createNimAiClientFromEnv } from '@/services/nim-ai-client';
import { createConsoleLogger, type Logger } from '@/services/logger';
import { createInMemoryMessageBus } from '@/services/message-bus';

interface ServerServices {
  factory: AgentFactory;
  logger: Logger;
}

let cached: ServerServices | null = null;

/**
 * Lazy singleton so importing route modules never touches env vars at
 * build time — the NIM key is only read on the first request.
 */
export const getServerServices = (): ServerServices => {
  if (cached) return cached;

  const logger = createConsoleLogger('agents');
  cached = {
    logger,
    factory: createAgentFactory({
      registry: defaultAgentRegistry,
      services: {
        ai: createNimAiClientFromEnv(),
        logger,
        messageBus: createInMemoryMessageBus(),
      },
    }),
  };
  return cached;
};
