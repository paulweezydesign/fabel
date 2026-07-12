import type { Artifact } from '@/core/artifact-store';
import { isAgentRunResult } from '@/core/agent-result';
import type { WorkflowDefinition, WorkflowRunSnapshot } from '@/core/workflow-runner';
import { formatArtifactContent } from './dashboard-state';

export type ReviewContentKind = 'outreach_message' | 'summary' | 'fallback';

export interface ReviewContent {
  readonly kind: ReviewContentKind;
  readonly headline: string;
  readonly detail?: string;
}

export const getGatedArtifact = (
  artifacts: readonly Artifact[],
  pendingStepId: string | null,
  definition: WorkflowDefinition,
): Artifact | null => {
  if (!pendingStepId) return null;

  const step = definition.steps.find((candidate) => candidate.id === pendingStepId);
  if (!step) return null;

  return (
    artifacts.find((artifact) => artifact.title === step.title) ??
    artifacts.find((artifact) => artifact.agentType === step.agentType) ??
    null
  );
};

export const extractReviewContent = (artifact: Artifact | null): ReviewContent | null => {
  if (!artifact) return null;

  const { content } = artifact;
  if (isAgentRunResult(content)) {
    const output = content.output;
    if (typeof output === 'object' && output !== null) {
      const record = output as Record<string, unknown>;
      const message = record.message;
      if (typeof message === 'string' && message.trim()) {
        return {
          kind: 'outreach_message',
          headline: message.trim(),
          detail: content.summary.trim() && content.summary !== message ? content.summary : undefined,
        };
      }
    }

    if (content.summary.trim()) {
      return {
        kind: 'summary',
        headline: content.summary.trim(),
      };
    }
  }

  return {
    kind: 'fallback',
    headline: formatArtifactContent(content),
  };
};

export const formatApprovalToast = (run: WorkflowRunSnapshot): string => {
  if (run.status === 'completed') {
    return 'Approved — workflow completed';
  }
  if (run.status === 'running') {
    return 'Approved — workflow resuming';
  }
  return 'Approved';
};
