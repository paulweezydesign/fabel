import { describe, expect, it } from 'vitest';
import { isTerminalRunStatus, shouldPollRun } from './dashboard-state';
import type { WorkflowRunSnapshot } from '@/core/workflow-runner';

const snapshot = (
  status: WorkflowRunSnapshot['status'],
): WorkflowRunSnapshot => ({
  id: 'run-1',
  definitionId: 'lead-to-outreach',
  projectId: 'proj-1',
  status,
  startedAt: '2026-07-05T10:00:00.000Z',
  pendingApprovalStepId: null,
  error: null,
  stepStatuses: {},
  approvedStepIds: [],
  workflowInput: {},
  createdAt: '2026-07-05T10:00:00.000Z',
  updatedAt: '2026-07-05T10:01:00.000Z',
});

describe('isTerminalRunStatus', () => {
  it.each(['needs_review', 'completed', 'failed', 'rejected'] as const)(
    'treats %s as terminal',
    (status) => {
      expect(isTerminalRunStatus(status)).toBe(true);
    },
  );

  it.each(['pending', 'running'] as const)('treats %s as non-terminal', (status) => {
    expect(isTerminalRunStatus(status)).toBe(false);
  });
});

describe('shouldPollRun', () => {
  it('polls while a run is actively executing', () => {
    expect(shouldPollRun(snapshot('running'))).toBe(true);
  });

  it('stops polling at approval gates and terminal states', () => {
    expect(shouldPollRun(snapshot('needs_review'))).toBe(false);
    expect(shouldPollRun(snapshot('completed'))).toBe(false);
    expect(shouldPollRun(snapshot('failed'))).toBe(false);
    expect(shouldPollRun(snapshot('rejected'))).toBe(false);
  });
});
