import type { AgentType } from '@/core/agent-types';
import type { StepStatus, WorkflowDefinition, WorkflowRunSnapshot } from '@/core/workflow-runner';

export interface StepTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly agentType: AgentType;
  readonly status: StepStatus;
  readonly requiresApproval: boolean;
  readonly awaitingApproval: boolean;
}

export const buildStepTimeline = (
  definition: WorkflowDefinition,
  run: WorkflowRunSnapshot,
): StepTimelineItem[] =>
  definition.steps.map((step) => ({
    id: step.id,
    title: step.title,
    agentType: step.agentType,
    status: run.stepStatuses[step.id] ?? 'pending',
    requiresApproval: step.requiresApproval ?? false,
    awaitingApproval:
      run.status === 'needs_review' && run.pendingApprovalStepId === step.id,
  }));

export const canApproveRun = (run: WorkflowRunSnapshot): boolean =>
  run.status === 'needs_review' && run.pendingApprovalStepId !== null;

export const isRunActive = (run: WorkflowRunSnapshot): boolean => run.status === 'running';

export const formatArtifactContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
};

export const statusLabel = (status: WorkflowRunSnapshot['status']): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'needs_review':
      return 'Needs review';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
  }
};
