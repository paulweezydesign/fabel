import { isAgentRunResult, type AgentRunResult } from '@/core/agent-result';
import type { Artifact } from '@/core/artifact-store';

/**
 * Operator edits applied to a gated artifact before approve (or saved as a draft).
 * Only provided fields are overwritten.
 */
export interface ApprovalEdits {
  readonly message?: string;
  readonly subject?: string;
  readonly briefTitle?: string;
  readonly brief?: string;
  readonly summary?: string;
  /** Newline-separated checklist items for QA gates. */
  readonly checklistText?: string;
}

export interface EditableApprovalDraft {
  readonly message: string;
  readonly subject: string;
  readonly briefTitle: string;
  readonly brief: string;
  readonly summary: string;
  readonly checklistText: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const linesFromUnknown = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join('\n');
  }
  return typeof value === 'string' ? value : '';
};

export const extractEditableDraft = (artifact: Artifact | null): EditableApprovalDraft => {
  const empty: EditableApprovalDraft = {
    message: '',
    subject: '',
    briefTitle: '',
    brief: '',
    summary: '',
    checklistText: '',
  };
  if (!artifact || !isAgentRunResult(artifact.content)) return empty;

  const output = asRecord(artifact.content.output);
  return {
    message: typeof output.message === 'string' ? output.message : '',
    subject: typeof output.subject === 'string' ? output.subject : '',
    briefTitle: typeof output.briefTitle === 'string' ? output.briefTitle : '',
    brief: typeof output.brief === 'string' ? output.brief : '',
    summary: artifact.content.summary,
    checklistText: linesFromUnknown(output.checklist),
  };
};

export type ApprovalEditKind =
  | 'outreach_message'
  | 'project_brief'
  | 'build_plan_qa'
  | 'summary'
  | 'fallback';

/** Build an edits payload for the active review kind only (avoids wiping unrelated fields). */
export const draftToEdits = (
  draft: EditableApprovalDraft,
  kind: ApprovalEditKind = 'outreach_message',
): ApprovalEdits => {
  switch (kind) {
    case 'project_brief':
      return {
        briefTitle: draft.briefTitle,
        brief: draft.brief,
        summary: draft.summary,
      };
    case 'build_plan_qa':
      return {
        checklistText: draft.checklistText,
        summary: draft.summary,
      };
    case 'outreach_message':
    case 'summary':
    case 'fallback':
    default:
      return {
        message: draft.message,
        subject: draft.subject,
        summary: draft.summary,
      };
  }
};

export const hasApprovalEdits = (edits: ApprovalEdits | undefined): boolean => {
  if (!edits) return false;
  return Object.values(edits).some((value) => typeof value === 'string');
};

/**
 * Merges operator edits into an AgentRunResult artifact content.
 * Throws when content is not a structured agent result.
 */
export const applyApprovalEdits = (
  content: unknown,
  edits: ApprovalEdits,
): AgentRunResult => {
  if (!isAgentRunResult(content)) {
    throw new Error('Only structured agent artifacts can be edited at the approval gate.');
  }

  const output = asRecord(content.output);

  if (edits.message !== undefined) output.message = edits.message.trim();
  if (edits.subject !== undefined) output.subject = edits.subject.trim();
  if (edits.briefTitle !== undefined) output.briefTitle = edits.briefTitle.trim();
  if (edits.brief !== undefined) output.brief = edits.brief.trim();
  if (edits.checklistText !== undefined) {
    output.checklist = edits.checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const summary =
    edits.summary !== undefined && edits.summary.trim().length > 0
      ? edits.summary.trim()
      : content.summary;

  return {
    ...content,
    summary,
    output,
  };
};
