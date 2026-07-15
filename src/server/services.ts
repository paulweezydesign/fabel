import { createAgentFactory, type AgentFactory } from '@/core/agent-factory';
import type { ArtifactStore } from '@/core/artifact-store';
import type { WorkflowRunStore } from '@/core/workflow-run-store';
import { defaultAgentRegistry } from '@/agents/registry';
import { createAiClientFromEnv } from '@/services/ai-client-factory';
import { createConsoleLogger, type Logger } from '@/services/logger';
import { createInMemoryMessageBus } from '@/services/message-bus';
import { createStoresFromEnv } from './persistence';
import { createWorkflowService, type WorkflowService } from './workflow-service';

interface ServerServices {
  factory: AgentFactory;
  logger: Logger;
  artifactStore: ArtifactStore;
  runStore: WorkflowRunStore;
  workflowService: WorkflowService;
}

let cached: ServerServices | null = null;

/**
 * Lazy singleton so importing route modules never touches env vars at
 * build time — provider credentials and persistence mode are only read
 * on the first request.
 */
export const getServerServices = (): ServerServices => {
  if (cached) return cached;

  const logger = createConsoleLogger('agents');
  const { artifactStore, runStore } = createStoresFromEnv();

  const factory = createAgentFactory({
    registry: defaultAgentRegistry,
    services: {
      ai: createAiClientFromEnv(),
      logger,
      messageBus: createInMemoryMessageBus(),
    },
  });

  cached = {
    logger,
    factory,
    artifactStore,
    runStore,
    workflowService: createWorkflowService({
      runStore,
      artifactStore,
      factory,
      logger,
    }),
  };
  return cached;
};
