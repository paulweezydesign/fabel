import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkflowRunSnapshot } from './workflow-runner';

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

  const readAll = async (): Promise<WorkflowRunSnapshot[]> => {
    let files: string[];
    try {
      files = await readdir(baseDir);
    } catch {
      return [];
    }
    return Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) =>
          JSON.parse(await readFile(path.join(baseDir, f), 'utf8')) as WorkflowRunSnapshot,
        ),
    );
  };

  return {
    save: async (snapshot) => {
      await mkdir(baseDir, { recursive: true });
      await writeFile(fileFor(snapshot.id), JSON.stringify(snapshot, null, 2), 'utf8');
    },
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
