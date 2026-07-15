import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createFileArtifactStore,
  createInMemoryArtifactStore,
  type ArtifactStore,
  type NewArtifact,
} from './artifact-store';
import { AgentType } from './agent-types';

const sampleArtifact = (overrides: Partial<NewArtifact> = {}): NewArtifact => ({
  workflowId: 'wf-1',
  projectId: 'proj-1',
  agentType: AgentType.Research,
  title: 'Prospect research',
  content: { facts: ['They sell shoes'], sources: ['site'] },
  ...overrides,
});

/**
 * Contract suite (AC-13): every ArtifactStore implementation must pass the
 * exact same tests, so implementations stay swappable.
 */
const describeArtifactStoreContract = (
  name: string,
  makeStore: () => Promise<ArtifactStore>,
  cleanup: () => Promise<void> = async () => {},
) => {
  describe(name, () => {
    let store: ArtifactStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(cleanup);

    it('assigns an id and persists all fields on save (FR-12, AC-12)', async () => {
      const saved = await store.save(sampleArtifact());

      expect(saved.id).toBeTruthy();
      expect(saved).toMatchObject(sampleArtifact());
      expect(saved.createdAt).toBeTruthy();
    });

    it('round-trips an artifact by id (AC-12)', async () => {
      const saved = await store.save(sampleArtifact());
      const found = await store.getById(saved.id);
      expect(found).toEqual(saved);
    });

    it('returns null for an unknown id', async () => {
      expect(await store.getById('nope')).toBeNull();
    });

    it('lists artifacts by workflow id in insertion order (FR-14, AC-11)', async () => {
      const first = await store.save(sampleArtifact({ title: 'first' }));
      const second = await store.save(
        sampleArtifact({ title: 'second', agentType: AgentType.ClientGrowth }),
      );
      await store.save(sampleArtifact({ workflowId: 'wf-other', title: 'noise' }));

      const artifacts = await store.listByWorkflow('wf-1');

      expect(artifacts.map((a) => a.id)).toEqual([first.id, second.id]);
    });

    it('returns an empty list for a workflow with no artifacts (empty state)', async () => {
      expect(await store.listByWorkflow('wf-none')).toEqual([]);
    });

    it('gives each artifact a distinct id', async () => {
      const a = await store.save(sampleArtifact());
      const b = await store.save(sampleArtifact());
      expect(a.id).not.toBe(b.id);
    });

    it('updates artifact content in place without changing id or sequence', async () => {
      const saved = await store.save(sampleArtifact({ content: { message: 'old' } }));
      const updated = await store.update(saved.id, { message: 'revised' });

      expect(updated.id).toBe(saved.id);
      expect(updated.sequence).toBe(saved.sequence);
      expect(updated.content).toEqual({ message: 'revised' });
      expect(await store.getById(saved.id)).toEqual(updated);
    });

    it('throws when updating an unknown artifact id', async () => {
      await expect(store.update('missing', { x: 1 })).rejects.toThrow(/missing/);
    });
  });
};

describeArtifactStoreContract('InMemoryArtifactStore', async () =>
  createInMemoryArtifactStore(),
);

let fileStoreDir: string;
describeArtifactStoreContract(
  'FileArtifactStore',
  async () => {
    fileStoreDir = await mkdtemp(path.join(tmpdir(), 'artifacts-'));
    return createFileArtifactStore(fileStoreDir);
  },
  async () => {
    await rm(fileStoreDir, { recursive: true, force: true });
  },
);

describe('FileArtifactStore persistence', () => {
  it('survives a store restart by re-reading from disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'artifacts-'));
    try {
      const first = createFileArtifactStore(dir);
      const saved = await first.save(sampleArtifact());

      const reopened = createFileArtifactStore(dir);
      const found = await reopened.getById(saved.id);

      expect(found).toEqual(saved);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
