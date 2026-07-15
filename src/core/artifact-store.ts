import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createKeyedAsyncLock } from './async-lock';
import type { AgentType } from './agent-types';

const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(tempPath, filePath);
};

/**
 * Persisted output of a workflow step (FR-12). The interface hides storage
 * details so implementations can be swapped — in-memory, file, later a
 * database — without touching agents or the runner (FR-13).
 */
export interface Artifact {
  readonly id: string;
  readonly workflowId: string;
  readonly projectId: string;
  readonly agentType: AgentType;
  readonly title: string;
  readonly content: unknown;
  readonly createdAt: string;
  /** Monotonic insertion index within the store, used for stable ordering. */
  readonly sequence: number;
}

export type NewArtifact = Omit<Artifact, 'id' | 'createdAt' | 'sequence'>;

export interface ArtifactStore {
  save(artifact: NewArtifact): Promise<Artifact>;
  getById(id: string): Promise<Artifact | null>;
  listByWorkflow(workflowId: string): Promise<Artifact[]>;
  /** Replace artifact content in place (used for edit-before-approve). */
  update(id: string, content: unknown): Promise<Artifact>;
}

const bySequence = (a: Artifact, b: Artifact) => a.sequence - b.sequence;

export const createInMemoryArtifactStore = (): ArtifactStore => {
  const artifacts = new Map<string, Artifact>();
  let sequence = 0;

  return {
    save: async (artifact) => {
      const saved: Artifact = {
        ...artifact,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        sequence: sequence++,
      };
      artifacts.set(saved.id, saved);
      return saved;
    },
    getById: async (id) => artifacts.get(id) ?? null,
    listByWorkflow: async (workflowId) =>
      [...artifacts.values()].filter((a) => a.workflowId === workflowId).sort(bySequence),
    update: async (id, content) => {
      const existing = artifacts.get(id);
      if (!existing) {
        throw new Error(`Artifact "${id}" not found.`);
      }
      const updated: Artifact = { ...existing, content };
      artifacts.set(id, updated);
      return updated;
    },
  };
};

/**
 * File-based store: one JSON file per artifact under baseDir. State is
 * re-read from disk on every call so separate store instances (e.g. across
 * process restarts) see the same data.
 */
export const createFileArtifactStore = (baseDir: string): ArtifactStore => {
  const fileFor = (id: string) => path.join(baseDir, `${id}.json`);
  const withLock = createKeyedAsyncLock();

  const readAll = async (): Promise<Artifact[]> => {
    let files: string[];
    try {
      files = await readdir(baseDir);
    } catch {
      return [];
    }
    const artifacts = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          try {
            return JSON.parse(await readFile(path.join(baseDir, f), 'utf8')) as Artifact;
          } catch {
            return null;
          }
        }),
    );
    return artifacts
      .filter((artifact): artifact is Artifact => artifact !== null)
      .sort(bySequence);
  };

  return {
    save: async (artifact) =>
      withLock('__save__', async () => {
        await mkdir(baseDir, { recursive: true });
        const existing = await readAll();
        const nextSequence = existing.length
          ? Math.max(...existing.map((a) => a.sequence)) + 1
          : 0;
        const saved: Artifact = {
          ...artifact,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          sequence: nextSequence,
        };
        await writeJsonAtomic(fileFor(saved.id), saved);
        return saved;
      }),
    getById: async (id) => {
      try {
        return JSON.parse(await readFile(fileFor(id), 'utf8')) as Artifact;
      } catch {
        return null;
      }
    },
    listByWorkflow: async (workflowId) =>
      (await readAll()).filter((a) => a.workflowId === workflowId),
    update: async (id, content) =>
      withLock(id, async () => {
        let existing: Artifact | null = null;
        try {
          existing = JSON.parse(await readFile(fileFor(id), 'utf8')) as Artifact;
        } catch {
          existing = null;
        }
        if (!existing) {
          throw new Error(`Artifact "${id}" not found.`);
        }
        const updated: Artifact = { ...existing, content };
        await mkdir(baseDir, { recursive: true });
        await writeJsonAtomic(fileFor(id), updated);
        return updated;
      }),
  };
};
