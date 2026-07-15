import { randomUUID } from 'node:crypto';
import type { AgentFactory } from './agent-factory';
import type { AgentType } from './agent-types';
import { createAgentContext, type AgentContext } from './agent-context';
import { isAgentRunResult } from './agent-result';
import type { ArtifactStore } from './artifact-store';
import type { TaskInput } from './base-agent';
import type { Logger } from '@/services/logger';

/**
 * A single unit of work in a workflow (FR-9).
 */
export interface WorkflowStep {
  readonly id: string;
  readonly title: string;
  readonly agentType: AgentType;
  readonly dependsOn?: readonly string[];
  /** When true, the workflow pauses for human review after this step's
   * output is produced, so the artifact itself can be reviewed. */
  readonly requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly steps: readonly WorkflowStep[];
  readonly context?: AgentContext;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'needs_review'
  | 'completed'
  | 'failed'
  | 'rejected';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** Serialisable workflow run state for persistence across HTTP requests. */
export interface WorkflowRunSnapshot {
  readonly id: string;
  readonly definitionId: string;
  readonly projectId: string;
  readonly status: WorkflowStatus;
  readonly startedAt: string | null;
  readonly pendingApprovalStepId: string | null;
  readonly error: string | null;
  readonly stepStatuses: Record<string, StepStatus>;
  readonly approvedStepIds: readonly string[];
  readonly workflowInput: TaskInput;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowRun {
  readonly id: string;
  readonly status: WorkflowStatus;
  readonly startedAt: string | null;
  readonly pendingApprovalStepId: string | null;
  readonly error: string | null;
  stepStatus(stepId: string): StepStatus;
  getSnapshot(): WorkflowRunSnapshot;
  start(input: TaskInput): Promise<void>;
  approve(stepId: string): Promise<void>;
  reject(stepId: string, reason?: string): Promise<void>;
}

interface WorkflowRunInit {
  definition: WorkflowDefinition;
  factory: AgentFactory;
  artifactStore: ArtifactStore;
  logger: Logger;
  snapshot?: WorkflowRunSnapshot;
  /** Called after each persisted state transition — used for async progress updates. */
  onProgress?: (snapshot: WorkflowRunSnapshot) => void | Promise<void>;
}

const validateSteps = (steps: readonly WorkflowStep[]): void => {
  const ids = new Set(steps.map((s) => s.id));

  const unknownDeps = steps.flatMap((step) =>
    (step.dependsOn ?? [])
      .filter((dep) => !ids.has(dep))
      .map((dep) => `step "${step.id}" depends on unknown step "${dep}"`),
  );
  if (unknownDeps.length > 0) {
    throw new Error(`Invalid workflow: ${unknownDeps.join('; ')}.`);
  }

  const remaining = new Map(steps.map((s) => [s.id, s.dependsOn ?? []]));
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [id, deps] of remaining) {
      if (deps.every((dep) => !remaining.has(dep))) {
        remaining.delete(id);
        progressed = true;
      }
    }
  }
  if (remaining.size > 0) {
    throw new Error(
      `Invalid workflow: circular dependency involving steps ${[...remaining.keys()]
        .map((id) => `"${id}"`)
        .join(', ')}.`,
    );
  }
};

const recordFromMap = (stepStatuses: Map<string, StepStatus>): Record<string, StepStatus> =>
  Object.fromEntries(stepStatuses);

/**
 * Deterministic sequential workflow execution with dependency handling and
 * approval gates (FR-10, FR-11). Supports serialisation via getSnapshot()
 * and resumption by passing snapshot on construction.
 */
export const createWorkflowRun = ({
  definition,
  factory,
  artifactStore,
  logger,
  snapshot,
  onProgress,
}: WorkflowRunInit): WorkflowRun => {
  const id = snapshot?.id ?? randomUUID();
  const createdAt = snapshot?.createdAt ?? new Date().toISOString();
  let updatedAt = snapshot?.updatedAt ?? createdAt;

  const stepStatuses = new Map<string, StepStatus>(
    snapshot
      ? Object.entries(snapshot.stepStatuses)
      : definition.steps.map((step) => [step.id, 'pending' as StepStatus]),
  );
  const approvedSteps = new Set<string>(snapshot?.approvedStepIds ?? []);

  let status: WorkflowStatus = snapshot?.status ?? 'pending';
  let startedAt: string | null = snapshot?.startedAt ?? null;
  let pendingApprovalStepId: string | null = snapshot?.pendingApprovalStepId ?? null;
  let error: string | null = snapshot?.error ?? null;
  let workflowInput: TaskInput = snapshot?.workflowInput ?? {};

  const buildSnapshot = (): WorkflowRunSnapshot => ({
    id,
    definitionId: definition.id,
    projectId: definition.projectId,
    status,
    startedAt,
    pendingApprovalStepId,
    error,
    stepStatuses: recordFromMap(stepStatuses),
    approvedStepIds: [...approvedSteps],
    workflowInput,
    createdAt,
    updatedAt,
  });

  const touch = () => {
    updatedAt = new Date().toISOString();
    if (onProgress) void onProgress(buildSnapshot());
  };

  const nextReadyStep = (): WorkflowStep | undefined =>
    definition.steps.find(
      (step) =>
        stepStatuses.get(step.id) === 'pending' &&
        (step.dependsOn ?? []).every((dep) => stepStatuses.get(dep) === 'completed'),
    );

  const executeStep = async (step: WorkflowStep, input: TaskInput): Promise<boolean> => {
    stepStatuses.set(step.id, 'in_progress');
    touch();
    logger.info(`workflow step started`, { workflowId: id, stepId: step.id });

    const context = createAgentContext({
      projectId: definition.projectId,
      ...definition.context,
    });
    const agent = factory.createAgent(step.agentType, context);
    const priorArtifacts = await artifactStore.listByWorkflow(id);

    const result = await agent.assignTask({
      workflowInput: input,
      stepTitle: step.title,
      priorArtifacts,
    });

    if (!isAgentRunResult(result)) {
      stepStatuses.set(step.id, 'failed');
      error = `Step "${step.id}" produced a malformed result that does not conform to AgentRunResult.`;
      touch();
      logger.error(error, { workflowId: id, stepId: step.id });
      return false;
    }

    if (result.status === 'failure') {
      stepStatuses.set(step.id, 'failed');
      error = result.summary;
      touch();
      logger.error(`workflow step failed`, {
        workflowId: id,
        stepId: step.id,
        error: result.summary,
      });
      return false;
    }

    await artifactStore.save({
      workflowId: id,
      projectId: definition.projectId,
      agentType: step.agentType,
      title: step.title,
      content: result,
    });
    stepStatuses.set(step.id, 'completed');
    touch();
    logger.info(`workflow step completed`, { workflowId: id, stepId: step.id });
    return true;
  };

  const runLoop = async (input: TaskInput): Promise<void> => {
    status = 'running';
    touch();

    for (let step = nextReadyStep(); step; step = nextReadyStep()) {
      const succeeded = await executeStep(step, input);
      if (!succeeded) {
        status = 'failed';
        touch();
        return;
      }
      if (step.requiresApproval && !approvedSteps.has(step.id)) {
        pendingApprovalStepId = step.id;
        status = 'needs_review';
        touch();
        logger.info(`workflow paused for review`, { workflowId: id, stepId: step.id });
        return;
      }
    }

    status = 'completed';
    pendingApprovalStepId = null;
    touch();
    logger.info(`workflow completed`, { workflowId: id });
  };

  return {
    id,
    get status() {
      return status;
    },
    get startedAt() {
      return startedAt;
    },
    get pendingApprovalStepId() {
      return pendingApprovalStepId;
    },
    get error() {
      return error;
    },
    stepStatus: (stepId) => {
      const stepStatus = stepStatuses.get(stepId);
      if (!stepStatus) throw new Error(`Unknown step "${stepId}".`);
      return stepStatus;
    },
    getSnapshot: buildSnapshot,
    start: async (input) => {
      if (status !== 'pending') {
        throw new Error(
          `Workflow run ${id} cannot start from status "${status}"; it has already been started.`,
        );
      }
      validateSteps(definition.steps);
      workflowInput = input;
      startedAt = new Date().toISOString();
      touch();
      await runLoop(input);
    },
    approve: async (stepId) => {
      if (status !== 'needs_review' || pendingApprovalStepId === null) {
        throw new Error(`Workflow run ${id} is not awaiting review.`);
      }
      if (stepId !== pendingApprovalStepId) {
        throw new Error(
          `Step "${stepId}" is not awaiting approval; expected "${pendingApprovalStepId}".`,
        );
      }
      approvedSteps.add(stepId);
      pendingApprovalStepId = null;
      touch();
      logger.info(`workflow step approved`, { workflowId: id, stepId });
      await runLoop(workflowInput);
    },
    reject: async (stepId, reason) => {
      if (status !== 'needs_review' || pendingApprovalStepId === null) {
        throw new Error(`Workflow run ${id} is not awaiting review.`);
      }
      if (stepId !== pendingApprovalStepId) {
        throw new Error(
          `Step "${stepId}" is not awaiting approval; expected "${pendingApprovalStepId}".`,
        );
      }
      const trimmed = reason?.trim();
      error = trimmed && trimmed.length > 0 ? trimmed : 'Rejected at approval gate';
      pendingApprovalStepId = null;
      status = 'rejected';
      touch();
      logger.info(`workflow step rejected`, { workflowId: id, stepId, reason: error });
    },
  };
};
