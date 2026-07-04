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
  | 'failed';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface WorkflowRun {
  readonly id: string;
  readonly status: WorkflowStatus;
  readonly startedAt: string | null;
  readonly pendingApprovalStepId: string | null;
  readonly error: string | null;
  stepStatus(stepId: string): StepStatus;
  start(input: TaskInput): Promise<void>;
  approve(stepId: string): Promise<void>;
}

interface WorkflowRunInit {
  definition: WorkflowDefinition;
  factory: AgentFactory;
  artifactStore: ArtifactStore;
  logger: Logger;
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

  // Cycle detection: repeatedly remove steps whose dependencies are all
  // removed; anything left participates in a cycle.
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

/**
 * Deterministic sequential workflow execution with dependency handling and
 * approval gates (FR-10, FR-11).
 */
export const createWorkflowRun = ({
  definition,
  factory,
  artifactStore,
  logger,
}: WorkflowRunInit): WorkflowRun => {
  const id = randomUUID();
  const stepStatuses = new Map<string, StepStatus>(
    definition.steps.map((step) => [step.id, 'pending']),
  );
  const approvedSteps = new Set<string>();

  let status: WorkflowStatus = 'pending';
  let startedAt: string | null = null;
  let pendingApprovalStepId: string | null = null;
  let error: string | null = null;

  const nextReadyStep = (): WorkflowStep | undefined =>
    definition.steps.find(
      (step) =>
        stepStatuses.get(step.id) === 'pending' &&
        (step.dependsOn ?? []).every((dep) => stepStatuses.get(dep) === 'completed'),
    );

  const executeStep = async (step: WorkflowStep, input: TaskInput): Promise<boolean> => {
    stepStatuses.set(step.id, 'in_progress');
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
      logger.error(error, { workflowId: id, stepId: step.id });
      return false;
    }

    if (result.status === 'failure') {
      stepStatuses.set(step.id, 'failed');
      error = result.summary;
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
    logger.info(`workflow step completed`, { workflowId: id, stepId: step.id });
    return true;
  };

  const runLoop = async (input: TaskInput): Promise<void> => {
    status = 'running';

    for (let step = nextReadyStep(); step; step = nextReadyStep()) {
      const succeeded = await executeStep(step, input);
      if (!succeeded) {
        status = 'failed';
        return;
      }
      if (step.requiresApproval && !approvedSteps.has(step.id)) {
        pendingApprovalStepId = step.id;
        status = 'needs_review';
        logger.info(`workflow paused for review`, { workflowId: id, stepId: step.id });
        return;
      }
    }

    status = 'completed';
    logger.info(`workflow completed`, { workflowId: id });
  };

  let workflowInput: TaskInput = {};

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
    start: async (input) => {
      if (status !== 'pending') {
        throw new Error(
          `Workflow run ${id} cannot start from status "${status}"; it has already been started.`,
        );
      }
      validateSteps(definition.steps);
      workflowInput = input;
      startedAt = new Date().toISOString();
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
      logger.info(`workflow step approved`, { workflowId: id, stepId });
      await runLoop(workflowInput);
    },
  };
};
