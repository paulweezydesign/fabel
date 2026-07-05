import { describe, expect, it } from 'vitest';
import {
  buildStepTimeline,
  canApproveRun,
  formatArtifactContent,
  isRunActive,
} from './dashboard-state';
import { resolveWorkflowDefinition } from '@/workflows/catalog';
import type { WorkflowRunSnapshot } from '@/core/workflow-runner';

const pausedRun = (): WorkflowRunSnapshot => ({
  id: 'run-1',
  definitionId: 'lead-to-outreach',
  projectId: 'proj-1',
  status: 'needs_review',
  startedAt: '2026-07-05T10:00:00.000Z',
  pendingApprovalStepId: 'draft-outreach',
  error: null,
  stepStatuses: {
    'research-prospect': 'completed',
    'draft-outreach': 'completed',
  },
  approvedStepIds: [],
  workflowInput: { leadName: 'Acme' },
  createdAt: '2026-07-05T10:00:00.000Z',
  updatedAt: '2026-07-05T10:01:00.000Z',
});

describe('buildStepTimeline', () => {
  it('maps workflow steps to timeline items with statuses', () => {
    const definition = resolveWorkflowDefinition('lead-to-outreach', 'proj-1');
    const timeline = buildStepTimeline(definition, pausedRun());

    expect(timeline).toEqual([
      {
        id: 'research-prospect',
        title: "Summarise the prospect's business",
        agentType: 'research',
        status: 'completed',
        requiresApproval: false,
        awaitingApproval: false,
      },
      {
        id: 'draft-outreach',
        title: 'Draft a personalised outreach plan',
        agentType: 'client_growth',
        status: 'completed',
        requiresApproval: true,
        awaitingApproval: true,
      },
    ]);
  });
});

describe('canApproveRun', () => {
  it('returns true when status is needs_review with a pending step', () => {
    expect(canApproveRun(pausedRun())).toBe(true);
  });

  it('returns false when completed or failed', () => {
    expect(canApproveRun({ ...pausedRun(), status: 'completed' })).toBe(false);
    expect(canApproveRun({ ...pausedRun(), status: 'failed' })).toBe(false);
  });
});

describe('isRunActive', () => {
  it('returns true only while running', () => {
    expect(isRunActive({ ...pausedRun(), status: 'running' })).toBe(true);
    expect(isRunActive(pausedRun())).toBe(false);
  });
});

describe('formatArtifactContent', () => {
  it('pretty-prints structured agent output', () => {
    const formatted = formatArtifactContent({
      status: 'success',
      summary: 'Researched Acme',
      output: { facts: ['Sells shoes'] },
    });
    expect(formatted).toContain('Researched Acme');
    expect(formatted).toContain('Sells shoes');
  });

  it('handles non-object content gracefully', () => {
    expect(formatArtifactContent('plain text')).toBe('plain text');
  });
});
