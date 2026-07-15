'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/core/artifact-store';
import type { WorkflowDefinition, WorkflowRunSnapshot } from '@/core/workflow-runner';
import {
  draftToEdits,
  extractEditableDraft,
  type ApprovalEdits,
  type EditableApprovalDraft,
} from '@/client/approval-edits';
import {
  extractReviewContent,
  getGatedArtifact,
  type ReviewContent,
  type ReviewSection,
} from '@/client/approval-ui';

interface ApprovalGatePanelProps {
  readonly run: WorkflowRunSnapshot;
  readonly definition: WorkflowDefinition;
  readonly artifacts: readonly Artifact[];
  readonly onApprove: (edits: ApprovalEdits) => void;
  readonly onSaveEdits: (edits: ApprovalEdits) => void;
  readonly onReject: (reason: string) => void;
  readonly approving: boolean;
  readonly saving: boolean;
  readonly rejecting: boolean;
  readonly busy: boolean;
}

const reviewLabel = (review: ReviewContent): string => {
  switch (review.kind) {
    case 'outreach_message':
      return 'Outreach message';
    case 'project_brief':
      return 'Project brief';
    case 'build_plan_qa':
      return 'QA checklist';
    case 'summary':
      return 'Summary';
    case 'fallback':
      return 'Review output';
  }
};

const SectionList = ({ sections }: { sections: readonly ReviewSection[] }) => (
  <dl className="approval-gate-panel__sections">
    {sections.map((section) => (
      <div key={section.label} className="approval-gate-panel__section">
        <dt>{section.label}</dt>
        <dd>
          {Array.isArray(section.value) ? (
            <ul>
              {section.value.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{section.value}</p>
          )}
        </dd>
      </div>
    ))}
  </dl>
);

export function ApprovalGatePanel({
  run,
  definition,
  artifacts,
  onApprove,
  onSaveEdits,
  onReject,
  approving,
  saving,
  rejecting,
  busy,
}: ApprovalGatePanelProps) {
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState<EditableApprovalDraft>(() =>
    extractEditableDraft(null),
  );

  const gatedStep = definition.steps.find((step) => step.id === run.pendingApprovalStepId);
  const gatedArtifact = getGatedArtifact(artifacts, run.pendingApprovalStepId, definition);
  const review = extractReviewContent(gatedArtifact);

  useEffect(() => {
    setDraft(extractEditableDraft(gatedArtifact));
  }, [gatedArtifact?.id, gatedArtifact?.content]);

  if (run.status !== 'needs_review' || !run.pendingApprovalStepId) {
    return null;
  }

  const kind = review?.kind ?? 'fallback';
  const edits = draftToEdits(draft, kind);

  return (
    <section className="panel approval-gate-panel" aria-labelledby="approval-gate-heading">
      <div className="approval-gate-panel__header">
        <div>
          <h2 id="approval-gate-heading">Approval required</h2>
          <p className="approval-gate-panel__hint">
            Edit the output if needed, then approve — or reject with a reason.
          </p>
        </div>
        <div className="approval-gate-panel__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onSaveEdits(edits)}
            disabled={busy}
          >
            {saving && <span className="spinner" />}
            Save edits
          </button>
          <button
            type="button"
            className="btn-reject"
            onClick={() => onReject(reason)}
            disabled={busy}
          >
            {rejecting && <span className="spinner" />}
            Reject
          </button>
          <button
            type="button"
            className="btn-approve"
            onClick={() => onApprove(edits)}
            disabled={busy}
          >
            {approving && <span className="spinner" />}
            Approve
          </button>
        </div>
      </div>

      {gatedStep && (
        <p className="approval-gate-panel__step">
          <span className="approval-gate-panel__step-label">Gated step</span>
          <strong>{gatedStep.title}</strong>
        </p>
      )}

      {review ? (
        <div className={`approval-gate-panel__content approval-gate-panel__content--${review.kind}`}>
          <span className="approval-gate-panel__content-label">{reviewLabel(review)}</span>

          {(kind === 'outreach_message' || kind === 'summary' || kind === 'fallback') && (
            <>
              <label className="approval-gate-panel__field">
                Outreach message
                <textarea
                  value={draft.message}
                  onChange={(e) => setDraft((current) => ({ ...current, message: e.target.value }))}
                  disabled={busy}
                  rows={4}
                />
              </label>
              <label className="approval-gate-panel__field">
                Subject
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft((current) => ({ ...current, subject: e.target.value }))}
                  disabled={busy}
                />
              </label>
            </>
          )}

          {kind === 'project_brief' && (
            <>
              <label className="approval-gate-panel__field">
                Brief title
                <input
                  value={draft.briefTitle}
                  onChange={(e) =>
                    setDraft((current) => ({ ...current, briefTitle: e.target.value }))
                  }
                  disabled={busy}
                />
              </label>
              <label className="approval-gate-panel__field">
                Brief
                <textarea
                  value={draft.brief}
                  onChange={(e) => setDraft((current) => ({ ...current, brief: e.target.value }))}
                  disabled={busy}
                  rows={5}
                />
              </label>
            </>
          )}

          {kind === 'build_plan_qa' && (
            <label className="approval-gate-panel__field">
              Checklist (one item per line)
              <textarea
                value={draft.checklistText}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, checklistText: e.target.value }))
                }
                disabled={busy}
                rows={5}
              />
            </label>
          )}

          <label className="approval-gate-panel__field">
            Summary
            <input
              value={draft.summary}
              onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))}
              disabled={busy}
            />
          </label>

          {review.sections && review.sections.length > 0 && (
            <SectionList sections={review.sections} />
          )}
        </div>
      ) : (
        <p className="empty-state">Waiting for the gated step output…</p>
      )}

      <label className="approval-gate-panel__reason">
        Rejection reason (optional)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Tone doesn’t match the agency voice"
          disabled={busy}
          rows={2}
        />
      </label>
    </section>
  );
}
