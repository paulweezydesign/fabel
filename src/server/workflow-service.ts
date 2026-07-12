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

export interface WorkflowRunSummary {
  readonly id: string;
  readonly definitionId: string;
  readonly projectId: string;
  readonly status: WorkflowRunSnapshot['status'];
  readonly startedAt: string | null;
  readonly updatedAt: string;
}

export type TaskScheduler = (task: () => Promise<void>) => void;

export interface DeferredTaskQueue {
  schedule: TaskScheduler;
  flush: () => Promise<void>;
}

/** Test helper: tasks run only when flush() is called. */
export const createDeferredTaskQueue = (): DeferredTaskQueue => {
  const tasks: (() => Promise<void>)[] = [];
  return {
    schedule: (task) => {
      tasks.push(task);
    },
    flush: async () => {
      while (tasks.length > 0) {
        const task = tasks.shift()!;
        await task();
      }
    },
  };
};

export interface WorkflowService {
  start(
    workflowId: string,
    options: { projectId: string; input: TaskInput },
  ): Promise<WorkflowRunSnapshot>;
  getRun(runId: string): Promise<WorkflowRunDetail>;
  listRuns(): Promise<readonly WorkflowRunSummary[]>;
  approve(runId: string, stepId: string): Promise<WorkflowRunSnapshot>;
  listDefinitions(): WorkflowDefinitionMeta[];
}

interface WorkflowServiceInit {
  runStore: WorkflowRunStore;
  artifactStore: ArtifactStore;
  factory: AgentFactory;
  logger: Logger;
  schedule?: TaskScheduler;
}

const runningResponse = (
  snapshot: WorkflowRunSnapshot,
  overrides: Partial<WorkflowRunSnapshot> = {},
): WorkflowRunSnapshot => ({
  ...snapshot,
  status: 'running',
  pendingApprovalStepId: null,
  startedAt: snapshot.startedAt ?? new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const toRunSummary = (snapshot: WorkflowRunSnapshot): WorkflowRunSummary => ({
  id: snapshot.id,
  definitionId: snapshot.definitionId,
  projectId: snapshot.projectId,
  status: snapshot.status,
  startedAt: snapshot.startedAt,
  updatedAt: snapshot.updatedAt,
});

export const createWorkflowService = ({
  runStore,
  artifactStore,
  factory,
  logger,
  schedule,
}: WorkflowServiceInit): WorkflowService => {
  const runInBackground =
    schedule ??
    ((task: () => Promise<void>) => {
      void task().catch((error) => {
        logger.error('background workflow task failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

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
      onProgress: (next) => runStore.save(next),
    });

  return {
    start: async (workflowId, { projectId, input }) => {
      if (!isWorkflowId(workflowId)) {
        throw new Error(`Unknown workflow "${workflowId}".`);
      }

      const definition = resolveWorkflowDefinition(workflowId, projectId);
      const run = createWorkflowRun({
        definition,
        factory,
        artifactStore,
        logger,
        onProgress: (next) => runStore.save(next),
      });
      const pendingSnapshot = run.getSnapshot();

      runInBackground(async () => {
        const runner = createWorkflowRun({
          definition,
          factory,
          artifactStore,
          logger,
          snapshot: pendingSnapshot,
          onProgress: (next) => runStore.save(next),
        });
        await runner.start(input);
        await persist(runner);
      });

      return runningResponse(pendingSnapshot, { workflowInput: input });
    },

    getRun: async (runId) => {
      const snapshot = await runStore.getById(runId);
      if (!snapshot) {
        throw new Error(`Workflow run "${runId}" not found.`);
      }
      const artifacts = await artifactStore.listByWorkflow(runId);
      return { run: snapshot, artifacts };
    },

    listRuns: async () => {
      const snapshots = await runStore.list();
      return snapshots.map(toRunSummary);
    },

    approve: async (runId, stepId) => {
      const snapshot = await runStore.getById(runId);
      if (!snapshot) {
        throw new Error(`Workflow run "${runId}" not found.`);
      }
      if (snapshot.status !== 'needs_review' || snapshot.pendingApprovalStepId === null) {
        throw new Error(`Workflow run ${runId} is not awaiting review.`);
      }
      if (stepId !== snapshot.pendingApprovalStepId) {
        throw new Error(
          `Step "${stepId}" is not awaiting approval; expected "${snapshot.pendingApprovalStepId}".`,
        );
      }

      const pausedSnapshot = snapshot;

      runInBackground(async () => {
        const runner = restoreRun(pausedSnapshot);
        await runner.approve(stepId);
        await persist(runner);
      });

      return runningResponse(pausedSnapshot);
    },

    listDefinitions: listWorkflowDefinitionMeta,
  };
};
