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

const SUPPORTED_MODES = ['file', 'memory'] as const;
export type PersistenceMode = (typeof SUPPORTED_MODES)[number];

export interface PersistenceStores {
  readonly artifactStore: ArtifactStore;
  readonly runStore: WorkflowRunStore;
}

/**
 * Resolves how workflow runs and artifacts are stored.
 * Defaults to file-backed persistence so local/dev past runs survive restarts.
 * Set FABEL_PERSISTENCE=memory for ephemeral processes (e.g. throwaway demos).
 */
export const resolvePersistenceMode = (
  env: NodeJS.ProcessEnv = process.env,
): PersistenceMode => {
  const raw = (env.FABEL_PERSISTENCE || 'file').toLowerCase();
  if ((SUPPORTED_MODES as readonly string[]).includes(raw)) {
    return raw as PersistenceMode;
  }
  throw new Error(
    `Unknown FABEL_PERSISTENCE "${raw}". Supported values: ${SUPPORTED_MODES.join(', ')}.`,
  );
};

export const createStoresFromEnv = (
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): PersistenceStores => {
  if (resolvePersistenceMode(env) === 'memory') {
    return {
      artifactStore: createInMemoryArtifactStore(),
      runStore: createInMemoryWorkflowRunStore(),
    };
  }

  return {
    artifactStore: createFileArtifactStore(path.join(cwd, '.artifacts')),
    runStore: createFileWorkflowRunStore(path.join(cwd, '.workflow-runs')),
  };
};
