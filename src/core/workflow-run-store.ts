import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createKeyedAsyncLock } from './async-lock';
import type { WorkflowRunSnapshot } from './workflow-runner';

const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(tempPath, filePath);
};

export interface WorkflowRunStore {
  save(snapshot: WorkflowRunSnapshot): Promise<void>;
  getById(id: string): Promise<WorkflowRunSnapshot | null>;
  list(): Promise<WorkflowRunSnapshot[]>;
}

const byUpdatedAtDesc = (a: WorkflowRunSnapshot, b: WorkflowRunSnapshot) =>
  b.updatedAt.localeCompare(a.updatedAt);

export const createInMemoryWorkflowRunStore = (): WorkflowRunStore => {
  const runs = new Map<string, WorkflowRunSnapshot>();

  return {
    save: async (snapshot) => {
      runs.set(snapshot.id, snapshot);
    },
    getById: async (id) => runs.get(id) ?? null,
    list: async () => [...runs.values()].sort(byUpdatedAtDesc),
  };
};

/**
 * File-based store: one JSON file per run under baseDir. Re-reads from disk
 * on every call so separate instances (e.g. across process restarts) see
 * the same data.
 */
export const createFileWorkflowRunStore = (baseDir: string): WorkflowRunStore => {
  const fileFor = (id: string) => path.join(baseDir, `${id}.json`);
  const withLock = createKeyedAsyncLock();

  const readAll = async (): Promise<WorkflowRunSnapshot[]> => {
    let files: string[];
    try {
      files = await readdir(baseDir);
    } catch {
      return [];
    }
    const snapshots = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          try {
            return JSON.parse(
              await readFile(path.join(baseDir, f), 'utf8'),
            ) as WorkflowRunSnapshot;
          } catch {
            return null;
          }
        }),
    );
    return snapshots.filter((snapshot): snapshot is WorkflowRunSnapshot => snapshot !== null);
  };

  return {
    save: async (snapshot) =>
      withLock(snapshot.id, async () => {
        await mkdir(baseDir, { recursive: true });
        await writeJsonAtomic(fileFor(snapshot.id), snapshot);
      }),
    getById: async (id) => {
      try {
        return JSON.parse(await readFile(fileFor(id), 'utf8')) as WorkflowRunSnapshot;
      } catch {
        return null;
      }
    },
    list: async () => (await readAll()).sort(byUpdatedAtDesc),
  };
};
