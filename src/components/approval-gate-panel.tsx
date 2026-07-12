'use client';

import type { Artifact } from '@/core/artifact-store';
import type { WorkflowDefinition, WorkflowRunSnapshot } from '@/core/workflow-runner';
import {
  extractReviewContent,
  getGatedArtifact,
  type ReviewContent,
} from '@/client/approval-ui';

interface ApprovalGatePanelProps {
  readonly run: WorkflowRunSnapshot;
  readonly definition: WorkflowDefinition;
  readonly artifacts: readonly Artifact[];
  readonly onApprove: () => void;
  readonly approving: boolean;
  readonly busy: boolean;
}

const reviewLabel = (review: ReviewContent): string => {
  switch (review.kind) {
    case 'outreach_message':
      return 'Outreach message';
    case 'summary':
      return 'Summary';
    case 'fallback':
      return 'Review output';
  }
};

export function ApprovalGatePanel({
  run,
  definition,
  artifacts,
  onApprove,
  approving,
  busy,
}: ApprovalGatePanelProps) {
  if (run.status !== 'needs_review' || !run.pendingApprovalStepId) {
    return null;
  }

  const gatedStep = definition.steps.find((step) => step.id === run.pendingApprovalStepId);
  const gatedArtifact = getGatedArtifact(artifacts, run.pendingApprovalStepId, definition);
  const review = extractReviewContent(gatedArtifact);

  return (
    <section className="panel approval-gate-panel" aria-labelledby="approval-gate-heading">
      <div className="approval-gate-panel__header">
        <div>
          <h2 id="approval-gate-heading">Approval required</h2>
          <p className="approval-gate-panel__hint">
            Review the output below before anything ships to the client.
          </p>
        </div>
        <button
          type="button"
          className="btn-approve"
          onClick={onApprove}
          disabled={busy}
        >
          {approving && <span className="spinner" />}
          Approve
        </button>
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
          <p className="approval-gate-panel__headline">{review.headline}</p>
          {review.detail && <p className="approval-gate-panel__detail">{review.detail}</p>}
        </div>
      ) : (
        <p className="empty-state">Waiting for the gated step output…</p>
      )}
    </section>
  );
}
