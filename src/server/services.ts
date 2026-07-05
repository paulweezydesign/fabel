import path from 'node:path';
import { createAgentFactory, type AgentFactory } from '@/core/agent-factory';
import {
  createFileArtifactStore,
  createInMemoryArtifactStore,
  type ArtifactStore,
} from '@/core/artifact-store';
import {
  createFileWorkflowRunStore,
  createInMemoryWorkflowRunStore,
  type WorkflowRunStore,
} from '@/core/workflow-run-store';
import { defaultAgentRegistry } from '@/agents/registry';
import { createNimAiClientFromEnv } from '@/services/nim-ai-client';
import { createConsoleLogger, type Logger } from '@/services/logger';
import { createInMemoryMessageBus } from '@/services/message-bus';
import { createWorkflowService, type WorkflowService } from './workflow-service';

interface ServerServices {
  factory: AgentFactory;
  logger: Logger;
  artifactStore: ArtifactStore;
  runStore: WorkflowRunStore;
  workflowService: WorkflowService;
}

let cached: ServerServices | null = null;

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Lazy singleton so importing route modules never touches env vars at
 * build time — the NIM key is only read on the first request.
 */
export const getServerServices = (): ServerServices => {
  if (cached) return cached;

  const logger = createConsoleLogger('agents');
  const artifactStore = isProduction()
    ? createFileArtifactStore(path.join(process.cwd(), '.artifacts'))
    : createInMemoryArtifactStore();
  const runStore = isProduction()
    ? createFileWorkflowRunStore(path.join(process.cwd(), '.workflow-runs'))
    : createInMemoryWorkflowRunStore();

  const factory = createAgentFactory({
    registry: defaultAgentRegistry,
    services: {
      ai: createNimAiClientFromEnv(),
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
