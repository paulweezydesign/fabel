import type { AgentFactory } from '@/core/agent-factory';
import type { Artifact, ArtifactStore } from '@/core/artifact-store';
import type { TaskInput } from '@/core/base-agent';
import type { WorkflowRunStore } from '@/core/workflow-run-store';
import {
  createWorkflowRun,
  type WorkflowRunSnapshot,
} from '@/core/workflow-runner';
import type { Logger } from '@/services/logger';
import {
  isWorkflowId,
  listWorkflowDefinitionMeta,
  resolveWorkflowDefinition,
  type WorkflowDefinitionMeta,
} from '@/workflows/catalog';

export interface WorkflowRunDetail {
  readonly run: WorkflowRunSnapshot;
  readonly artifacts: readonly Artifact[];
}

export interface WorkflowService {
  start(
    workflowId: string,
    options: { projectId: string; input: TaskInput },
  ): Promise<WorkflowRunSnapshot>;
  getRun(runId: string): Promise<WorkflowRunDetail>;
  approve(runId: string, stepId: string): Promise<WorkflowRunSnapshot>;
  listDefinitions(): WorkflowDefinitionMeta[];
}

interface WorkflowServiceInit {
  runStore: WorkflowRunStore;
  artifactStore: ArtifactStore;
  factory: AgentFactory;
  logger: Logger;
}

export const createWorkflowService = ({
  runStore,
  artifactStore,
  factory,
  logger,
}: WorkflowServiceInit): WorkflowService => {
  const persist = async (run: ReturnType<typeof createWorkflowRun>) => {
    await runStore.save(run.getSnapshot());
  };

  const restoreRun = (snapshot: WorkflowRunSnapshot) =>
    createWorkflowRun({
      definition: resolveWorkflowDefinition(
        snapshot.definitionId as Parameters<typeof resolveWorkflowDefinition>[0],
        snapshot.projectId,
      ),
      factory,
      artifactStore,
      logger,
      snapshot,
    });

  return {
    start: async (workflowId, { projectId, input }) => {
      if (!isWorkflowId(workflowId)) {
        throw new Error(`Unknown workflow "${workflowId}".`);
      }

      const run = createWorkflowRun({
        definition: resolveWorkflowDefinition(workflowId, projectId),
        factory,
        artifactStore,
        logger,
      });
      await run.start(input);
      await persist(run);
      return run.getSnapshot();
    },

    getRun: async (runId) => {
      const snapshot = await runStore.getById(runId);
      if (!snapshot) {
        throw new Error(`Workflow run "${runId}" not found.`);
      }
      const artifacts = await artifactStore.listByWorkflow(runId);
      return { run: snapshot, artifacts };
    },

    approve: async (runId, stepId) => {
      const snapshot = await runStore.getById(runId);
      if (!snapshot) {
        throw new Error(`Workflow run "${runId}" not found.`);
      }

      const run = restoreRun(snapshot);
      await run.approve(stepId);
      await persist(run);
      return run.getSnapshot();
    },

    listDefinitions: listWorkflowDefinitionMeta,
  };
};
