import { randomUUID } from "node:crypto";
import type { AgentContext } from "./agent-context.js";
import type { AgentFactory } from "./agent-factory.js";
import { isAgentRunResult } from "./agent-result.js";
import type { AgentType } from "./agent-types.js";
import type { ArtifactStore } from "./artifact-store.js";

/** FR-9: a single unit of work within a workflow. */
export interface WorkflowStep {
  readonly id: string;
  readonly title: string;
  readonly agentType: AgentType;
  readonly dependsOn?: readonly string[];
  readonly requiresApproval?: boolean;
  /** Instruction handed to the agent; defaults to {@link title}. */
  readonly prompt?: string;
}

export interface WorkflowDefinition {
  readonly name: string;
  readonly steps: readonly WorkflowStep[];
}

export type WorkflowStatus =
  | "running"
  | "needs_review"
  | "completed"
  | "failed";

export type StepRunStatus = "pending" | "completed" | "failed";

export interface StepState {
  readonly step: WorkflowStep;
  status: StepRunStatus;
  approved: boolean;
  artifactId?: string;
  error?: string;
}

export interface WorkflowRun {
  readonly workflowId: string;
  readonly name: string;
  status: WorkflowStatus;
  readonly steps: StepState[];
  readonly startedAt: string;
  finishedAt?: string;
  pausedStepId?: string;
  error?: string;
}

export interface StartOptions {
  readonly context?: AgentContext;
  readonly workflowInput?: unknown;
  readonly projectId?: string;
}

/** Raised when a definition is structurally invalid (§8). */
export class WorkflowValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid workflow definition: ${problems.join("; ")}`);
    this.name = "WorkflowValidationError";
  }
}

interface RunContext {
  readonly context: AgentContext;
  readonly workflowInput?: unknown;
  readonly projectId?: string;
}

/**
 * FR-10/FR-11: executes ordered steps with dependency handling, approval gates,
 * and fail-stop error handling. New workflows are pure data — no runner change
 * is needed to add one (US-7).
 */
export class WorkflowRunner {
  private readonly runs = new Map<string, WorkflowRun>();
  private readonly contexts = new Map<string, RunContext>();

  constructor(
    private readonly factory: AgentFactory,
    private readonly store: ArtifactStore,
  ) {}

  /** Validates structure, returning offending step IDs/messages (empty = ok). */
  validate(definition: WorkflowDefinition): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const step of definition.steps) {
      if (ids.has(step.id)) problems.push(`duplicate step id: ${step.id}`);
      ids.add(step.id);
    }
    for (const step of definition.steps) {
      for (const dep of step.dependsOn ?? []) {
        if (!ids.has(dep)) {
          problems.push(`step ${step.id} depends on unknown step: ${dep}`);
        }
      }
    }
    problems.push(...detectCycles(definition.steps));
    return problems;
  }

  getRun(workflowId: string): WorkflowRun | undefined {
    return this.runs.get(workflowId);
  }

  /** Starts a fresh workflow instance and drives it to its first resting state. */
  async start(
    definition: WorkflowDefinition,
    options: StartOptions = {},
  ): Promise<WorkflowRun> {
    const problems = this.validate(definition);
    if (problems.length > 0) throw new WorkflowValidationError(problems);

    const workflowId = randomUUID();
    const run: WorkflowRun = {
      workflowId,
      name: definition.name,
      status: "running",
      steps: definition.steps.map((step) => ({
        step,
        status: "pending",
        approved: false,
      })),
      startedAt: new Date().toISOString(),
    };
    this.runs.set(workflowId, run);
    this.contexts.set(workflowId, {
      context: options.context ?? { tenantId: "default" },
      workflowInput: options.workflowInput,
      projectId: options.projectId,
    });
    return this.drive(run);
  }

  /** FR-10 step 3 / AC-9: approve a paused gate and resume from its successor. */
  async approve(workflowId: string, stepId: string): Promise<WorkflowRun> {
    const run = this.runs.get(workflowId);
    if (!run) throw new Error(`Unknown workflow: ${workflowId}`);
    if (run.status !== "needs_review") {
      throw new Error(
        `Workflow ${workflowId} is not awaiting approval (status: ${run.status})`,
      );
    }
    const target = run.steps.find((s) => s.step.id === stepId);
    if (!target) throw new Error(`Unknown step: ${stepId}`);
    if (run.pausedStepId !== stepId) {
      throw new Error(`Step ${stepId} is not the step awaiting approval`);
    }
    target.approved = true;
    run.pausedStepId = undefined;
    run.status = "running";
    return this.drive(run);
  }

  private async drive(run: WorkflowRun): Promise<WorkflowRun> {
    const ctx = this.contexts.get(run.workflowId)!;
    for (;;) {
      const next = this.pickReadyStep(run);
      if (!next) break;

      await this.executeStep(run, next, ctx);
      if (next.status === "failed") {
        run.status = "failed";
        run.error = next.error;
        run.finishedAt = new Date().toISOString();
        return run;
      }
      if (next.step.requiresApproval && !next.approved) {
        run.status = "needs_review";
        run.pausedStepId = next.step.id;
        return run;
      }
    }
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    return run;
  }

  /** First pending step (definition order) whose dependencies are satisfied. */
  private pickReadyStep(run: WorkflowRun): StepState | undefined {
    return run.steps.find((candidate) => {
      if (candidate.status !== "pending") return false;
      return (candidate.step.dependsOn ?? []).every((depId) => {
        const dep = run.steps.find((s) => s.step.id === depId);
        return (
          dep?.status === "completed" &&
          (!dep.step.requiresApproval || dep.approved)
        );
      });
    });
  }

  private async executeStep(
    run: WorkflowRun,
    state: StepState,
    ctx: RunContext,
  ): Promise<void> {
    const { step } = state;
    try {
      const agent = this.factory.createAgent(step.agentType, ctx.context);
      const priorArtifacts = await this.store.getByWorkflowId(run.workflowId);
      const result = await agent.assignTask({
        prompt: step.prompt ?? step.title,
        workflowInput: ctx.workflowInput,
        priorArtifacts,
      });

      if (!isAgentRunResult(result)) {
        state.status = "failed";
        state.error = `Step ${step.id} produced malformed output`;
        return;
      }
      if (result.status === "failure") {
        state.status = "failed";
        state.error = result.summary;
        return;
      }

      const artifact = await this.store.save({
        workflowId: run.workflowId,
        ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
        agentType: step.agentType,
        title: step.title,
        content: result.output,
      });
      state.artifactId = artifact.id;
      state.status = "completed";
    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
    }
  }
}

/** Returns cycle problem messages naming the steps involved (§8). */
const detectCycles = (steps: readonly WorkflowStep[]): string[] => {
  const deps = new Map<string, readonly string[]>(
    steps.map((s) => [s.id, s.dependsOn ?? []]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const problems: string[] = [];

  const visit = (id: string, path: string[]): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      problems.push(`circular dependency: ${[...path, id].join(" -> ")}`);
      return;
    }
    visiting.add(id);
    for (const dep of deps.get(id) ?? []) {
      if (deps.has(dep)) visit(dep, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const step of steps) visit(step.id, []);
  return problems;
};
