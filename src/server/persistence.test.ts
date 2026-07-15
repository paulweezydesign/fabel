import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentType } from '@/core/agent-types';
import {
  createStoresFromEnv,
  resolvePersistenceMode,
  resolveSqliteDatabasePath,
} from './persistence';

describe('resolvePersistenceMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to sqlite so local runs survive restarts in one database', () => {
    vi.stubEnv('FABEL_PERSISTENCE', '');
    expect(resolvePersistenceMode()).toBe('sqlite');
  });

  it('selects memory when FABEL_PERSISTENCE=memory', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'memory');
    expect(resolvePersistenceMode()).toBe('memory');
  });

  it('selects file when FABEL_PERSISTENCE=file', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'file');
    expect(resolvePersistenceMode()).toBe('file');
  });

  it('selects sqlite when FABEL_PERSISTENCE=sqlite', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'sqlite');
    expect(resolvePersistenceMode()).toBe('sqlite');
  });

  it('fails fast for unknown persistence modes', () => {
    vi.stubEnv('FABEL_PERSISTENCE', 'redis');
    expect(() => resolvePersistenceMode()).toThrow(/FABEL_PERSISTENCE/);
    expect(() => resolvePersistenceMode()).toThrow(/redis/);
  });
});

describe('resolveSqliteDatabasePath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to .data/fabel.db under cwd', () => {
    vi.stubEnv('FABEL_SQLITE_PATH', '');
    expect(resolveSqliteDatabasePath('/app')).toBe(join('/app', '.data', 'fabel.db'));
  });

  it('honours relative FABEL_SQLITE_PATH against cwd', () => {
    vi.stubEnv('FABEL_SQLITE_PATH', 'custom/runs.db');
    expect(resolveSqliteDatabasePath('/app')).toBe(join('/app', 'custom/runs.db'));
  });

  it('honours absolute FABEL_SQLITE_PATH', () => {
    vi.stubEnv('FABEL_SQLITE_PATH', '/var/lib/fabel.db');
    expect(resolveSqliteDatabasePath('/app')).toBe('/var/lib/fabel.db');
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

  it('persists runs to disk and reloads them after reopen (file mode)', async () => {
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

  it('persists runs and artifacts in SQLite by default and reloads after reopen', async () => {
    vi.stubEnv('FABEL_PERSISTENCE', '');
    const dir = mkdtempSync(join(tmpdir(), 'fabel-sqlite-'));

    try {
      const stores = createStoresFromEnv(dir);
      const snapshot = {
        id: 'run-sqlite-1',
        definitionId: 'lead-to-outreach',
        projectId: 'proj-1',
        status: 'needs_review' as const,
        startedAt: '2026-07-15T00:00:00.000Z',
        pendingApprovalStepId: 'draft-outreach',
        error: null,
        stepStatuses: {},
        approvedStepIds: [],
        workflowInput: { leadName: 'Acme' },
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:00:00.000Z',
      };

      await stores.runStore.save(snapshot);
      const artifact = await stores.artifactStore.save({
        workflowId: snapshot.id,
        projectId: 'proj-1',
        agentType: AgentType.Research,
        title: 'Research',
        content: { summary: 'ok' },
      });

      const reopened = createStoresFromEnv(dir);
      await expect(reopened.runStore.getById('run-sqlite-1')).resolves.toEqual(snapshot);
      await expect(reopened.artifactStore.getById(artifact.id)).resolves.toEqual(artifact);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
