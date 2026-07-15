import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStoresFromEnv, resolvePersistenceMode } from './persistence';

describe('resolvePersistenceMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to file so local runs survive restarts', () => {
    vi.stubEnv('FABEL_PERSISTENCE', '');
    expect(resolvePersistenceMode()).toBe('file');
  });

  it('selects memory when FABEL_PERSISTENCE=memory', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'memory');
    expect(resolvePersistenceMode()).toBe('memory');
  });

  it('selects file when FABEL_PERSISTENCE=file', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'file');
    expect(resolvePersistenceMode()).toBe('file');
  });

  it('fails fast for unknown persistence modes', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'redis');
    expect(() => resolvePersistenceMode()).toThrow(/FABEL_PERSISTENCE/);
    expect(() => resolvePersistenceMode()).toThrow(/redis/);
  });
});

describe('createStoresFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates independent in-memory stores when persistence is memory', async () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'memory');
    const a = createStoresFromEnv();
    const b = createStoresFromEnv();

    await a.runStore.save({
      id: 'run-a',
      definitionId: 'lead-to-outreach',
      projectId: 'proj-1',
      status: 'completed',
      startedAt: null,
      pendingApprovalStepId: null,
      error: null,
      stepStatuses: {},
      approvedStepIds: [],
      workflowInput: {},
      createdAt: '2026-07-15T00:00:00.000Z',
      updatedAt: '2026-07-15T00:00:00.000Z',
    });

    await expect(b.runStore.getById('run-a')).resolves.toBeNull();
  });

  it('persists runs to disk and reloads them after reopen', async () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'file');
    const dir = mkdtempSync(join(tmpdir(), 'fabel-persist-'));

    try {
      const stores = createStoresFromEnv(dir);
      const snapshot = {
        id: 'run-persist-1',
        definitionId: 'lead-to-outreach',
        projectId: 'proj-1',
        status: 'completed' as const,
        startedAt: '2026-07-15T00:00:00.000Z',
        pendingApprovalStepId: null,
        error: null,
        stepStatuses: {},
        approvedStepIds: [],
        workflowInput: {},
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:00:00.000Z',
      };

      await stores.runStore.save(snapshot);
      const reopened = createStoresFromEnv(dir);
      await expect(reopened.runStore.getById('run-persist-1')).resolves.toEqual(snapshot);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
