import path from 'node:path';
import {
  createFileArtifactStore,
  createInMemoryArtifactStore,
  type ArtifactStore,
} from '@/core/artifact-store';
import {
  createFileWorkflowRunStore,
  createInMemoryWorkflowRunStore,
  type WorkflowRunStore,
} from '@/core/workflow-run-store';
import { createSqliteStores } from '@/core/sqlite-stores';

const SUPPORTED_MODES = ['sqlite', 'file', 'memory'] as const;
export type PersistenceMode = (typeof SUPPORTED_MODES)[number];

export interface PersistenceStores {
  readonly artifactStore: ArtifactStore;
  readonly runStore: WorkflowRunStore;
}

/**
 * Resolves how workflow runs and artifacts are stored.
 * Defaults to SQLite (`.data/fabel.db`) so local/dev past runs survive restarts
 * with a single durable database. Set FABEL_PERSISTENCE=file for the legacy
 * JSON directories, or memory for ephemeral processes.
 */
export const resolvePersistenceMode = (
  env: NodeJS.ProcessEnv = process.env,
): PersistenceMode => {
  const raw = (env.FABEL_PERSISTENCE || 'sqlite').toLowerCase();
  if ((SUPPORTED_MODES as readonly string[]).includes(raw)) {
    return raw as PersistenceMode;
  }
  throw new Error(
    `Unknown FABEL_PERSISTENCE "${raw}". Supported values: ${SUPPORTED_MODES.join(', ')}.`,
  );
};

export const resolveSqliteDatabasePath = (
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const configured = env.FABEL_SQLITE_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(cwd, configured);
  }
  return path.join(cwd, '.data', 'fabel.db');
};

export const createStoresFromEnv = (
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): PersistenceStores => {
  const mode = resolvePersistenceMode(env);

  if (mode === 'memory') {
    return {
      artifactStore: createInMemoryArtifactStore(),
      runStore: createInMemoryWorkflowRunStore(),
    };
  }

  if (mode === 'file') {
    return {
      artifactStore: createFileArtifactStore(path.join(cwd, '.artifacts')),
      runStore: createFileWorkflowRunStore(path.join(cwd, '.workflow-runs')),
    };
  }

  const { artifactStore, runStore } = createSqliteStores(
    resolveSqliteDatabasePath(cwd, env),
  );
  return { artifactStore, runStore };
};
