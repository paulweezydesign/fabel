import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createFileWorkflowRunStore,
  createInMemoryWorkflowRunStore,
  type WorkflowRunStore,
} from './workflow-run-store';
import type { WorkflowRunSnapshot } from './workflow-runner';

const sampleSnapshot = (
  overrides: Partial<WorkflowRunSnapshot> = {},
): WorkflowRunSnapshot => ({
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
  ...overrides,
});

const describeWorkflowRunStoreContract = (
  name: string,
  makeStore: () => Promise<WorkflowRunStore>,
  cleanup: () => Promise<void> = async () => {},
) => {
  describe(name, () => {
    let store: WorkflowRunStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(cleanup);

    it('round-trips a snapshot by id (AC-12 analogue)', async () => {
      const snapshot = sampleSnapshot();
      await store.save(snapshot);

      expect(await store.getById('run-1')).toEqual(snapshot);
    });

    it('returns null for an unknown id', async () => {
      expect(await store.getById('missing')).toBeNull();
    });

    it('updates an existing snapshot on save', async () => {
      await store.save(sampleSnapshot());
      const completed = sampleSnapshot({
        status: 'completed',
        pendingApprovalStepId: null,
        approvedStepIds: ['draft-outreach'],
        updatedAt: '2026-07-05T10:02:00.000Z',
      });

      await store.save(completed);

      expect(await store.getById('run-1')).toEqual(completed);
    });

    it('lists snapshots newest-first by updatedAt', async () => {
      await store.save(sampleSnapshot({ id: 'run-old', updatedAt: '2026-07-05T09:00:00.000Z' }));
      await store.save(
        sampleSnapshot({ id: 'run-new', updatedAt: '2026-07-05T11:00:00.000Z' }),
      );

      expect((await store.list()).map((run) => run.id)).toEqual(['run-new', 'run-old']);
    });

    it('returns an empty list when nothing is stored (empty state)', async () => {
      expect(await store.list()).toEqual([]);
    });
  });
};

describeWorkflowRunStoreContract('InMemoryWorkflowRunStore', async () =>
  createInMemoryWorkflowRunStore(),
);

let fileStoreDir: string;
describeWorkflowRunStoreContract(
  'FileWorkflowRunStore',
  async () => {
    fileStoreDir = await mkdtemp(path.join(tmpdir(), 'workflow-runs-'));
    return createFileWorkflowRunStore(fileStoreDir);
  },
  async () => {
    await rm(fileStoreDir, { recursive: true, force: true });
  },
);

describe('FileWorkflowRunStore persistence', () => {
  it('survives a store restart by re-reading from disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'workflow-runs-'));
    try {
      const first = createFileWorkflowRunStore(dir);
      await first.save(sampleSnapshot());

      const reopened = createFileWorkflowRunStore(dir);
      expect(await reopened.getById('run-1')).toEqual(sampleSnapshot());
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
