import type { Artifact } from '@/core/artifact-store';
import { isAgentRunResult } from '@/core/agent-result';
import type { WorkflowDefinition, WorkflowRunSnapshot } from '@/core/workflow-runner';
import { formatArtifactContent } from './dashboard-state';

export type ReviewContentKind =
  | 'outreach_message'
  | 'project_brief'
  | 'build_plan_qa'
  | 'summary'
  | 'fallback';

export interface ReviewSection {
  readonly label: string;
  readonly value: string | readonly string[];
}

export interface ReviewContent {
  readonly kind: ReviewContentKind;
  readonly headline: string;
  readonly detail?: string;
  readonly sections?: readonly ReviewSection[];
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');

const pushSection = (
  sections: ReviewSection[],
  label: string,
  value: unknown,
): void => {
  if (isNonEmptyString(value)) {
    sections.push({ label, value: value.trim() });
    return;
  }
  if (isStringArray(value)) {
    sections.push({ label, value });
  }
};

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

const extractOutreachReview = (
  record: Record<string, unknown>,
  summary: string,
): ReviewContent | null => {
  if (!isNonEmptyString(record.message)) return null;

  const sections: ReviewSection[] = [];
  pushSection(sections, 'Subject', record.subject);
  pushSection(sections, 'Channel', record.channel);
  pushSection(sections, 'Outreach plan', record.outreachPlan);
  pushSection(sections, 'Next steps', record.nextSteps);
  pushSection(sections, 'Tone notes', record.toneNotes);

  return {
    kind: 'outreach_message',
    headline: record.message.trim(),
    detail: summary.trim() && summary !== record.message ? summary.trim() : undefined,
    sections: sections.length > 0 ? sections : undefined,
  };
};

const extractBriefReview = (
  record: Record<string, unknown>,
  summary: string,
): ReviewContent | null => {
  const hasBrief =
    isNonEmptyString(record.brief) ||
    isNonEmptyString(record.briefTitle) ||
    isStringArray(record.goals) ||
    isStringArray(record.scope);

  if (!hasBrief) return null;

  const sections: ReviewSection[] = [];
  pushSection(sections, 'Goals', record.goals);
  pushSection(sections, 'Scope', record.scope);
  pushSection(sections, 'Out of scope', record.outOfScope);
  pushSection(sections, 'Success metrics', record.successMetrics);
  pushSection(sections, 'Blockers', record.blockers);
  pushSection(sections, 'Market context', record.marketContextSummary);

  const headline = isNonEmptyString(record.briefTitle)
    ? record.briefTitle.trim()
    : summary.trim() || 'Project brief';
  const detail = isNonEmptyString(record.brief)
    ? record.brief.trim()
    : summary.trim() && summary.trim() !== headline
      ? summary.trim()
      : undefined;

  return {
    kind: 'project_brief',
    headline,
    detail,
    sections: sections.length > 0 ? sections : undefined,
  };
};

const extractQaReview = (
  record: Record<string, unknown>,
  summary: string,
): ReviewContent | null => {
  const hasQa =
    isStringArray(record.checklist) ||
    isStringArray(record.acceptanceCriteria) ||
    isStringArray(record.issues) ||
    typeof record.readyForImplementation === 'boolean';

  if (!hasQa) return null;

  const sections: ReviewSection[] = [];
  pushSection(sections, 'Checklist', record.checklist);
  pushSection(sections, 'Acceptance criteria', record.acceptanceCriteria);
  pushSection(sections, 'Issues', record.issues);
  pushSection(sections, 'Blockers', record.blockers);
  if (typeof record.readyForImplementation === 'boolean') {
    sections.push({
      label: 'Ready for implementation',
      value: record.readyForImplementation ? 'Yes' : 'No',
    });
  }

  return {
    kind: 'build_plan_qa',
    headline: summary.trim() || 'QA checklist',
    sections: sections.length > 0 ? sections : undefined,
  };
};

export const extractReviewContent = (artifact: Artifact | null): ReviewContent | null => {
  if (!artifact) return null;

  const { content } = artifact;
  if (isAgentRunResult(content)) {
    const output = content.output;
    if (typeof output === 'object' && output !== null) {
      const record = output as Record<string, unknown>;
      return (
        extractOutreachReview(record, content.summary) ??
        extractBriefReview(record, content.summary) ??
        extractQaReview(record, content.summary) ??
        (content.summary.trim()
          ? { kind: 'summary', headline: content.summary.trim() }
          : null)
      );
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

export const formatRejectionToast = (run: WorkflowRunSnapshot): string => {
  const reason = run.error?.trim();
  return reason ? `Rejected — ${reason}` : 'Rejected at approval gate';
};
