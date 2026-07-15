import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AgentType } from './agent-types';
import type { Artifact, ArtifactStore, NewArtifact } from './artifact-store';
import type { WorkflowRunSnapshot } from './workflow-runner';
import type { WorkflowRunStore } from './workflow-run-store';

export type SqliteDatabase = DatabaseSync;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  workflow_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sequence INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_workflow_sequence
  ON artifacts (workflow_id, sequence);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY NOT NULL,
  snapshot TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_updated_at
  ON workflow_runs (updated_at DESC);
`;

export const openSqliteDatabase = (dbPath: string): SqliteDatabase => {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
};

const rowToArtifact = (row: {
  id: string;
  workflow_id: string;
  project_id: string;
  agent_type: string;
  title: string;
  content: string;
  created_at: string;
  sequence: number;
}): Artifact => ({
  id: row.id,
  workflowId: row.workflow_id,
  projectId: row.project_id,
  agentType: row.agent_type as AgentType,
  title: row.title,
  content: JSON.parse(row.content) as unknown,
  createdAt: row.created_at,
  sequence: row.sequence,
});

export const createSqliteArtifactStore = (db: SqliteDatabase): ArtifactStore => {
  const insert = db.prepare(`
    INSERT INTO artifacts (
      id, workflow_id, project_id, agent_type, title, content, created_at, sequence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectById = db.prepare(`SELECT * FROM artifacts WHERE id = ?`);
  const selectByWorkflow = db.prepare(`
    SELECT * FROM artifacts
    WHERE workflow_id = ?
    ORDER BY sequence ASC
  `);
  const nextSequence = db.prepare(
    `SELECT COALESCE(MAX(sequence), -1) + 1 AS next FROM artifacts`,
  );
  const updateContent = db.prepare(`UPDATE artifacts SET content = ? WHERE id = ?`);

  return {
    save: async (artifact: NewArtifact) => {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const sequence = (nextSequence.get() as { next: number }).next;
      insert.run(
        id,
        artifact.workflowId,
        artifact.projectId,
        artifact.agentType,
        artifact.title,
        JSON.stringify(artifact.content),
        createdAt,
        sequence,
      );
      return {
        ...artifact,
        id,
        createdAt,
        sequence,
      };
    },
    getById: async (id) => {
      const row = selectById.get(id) as Parameters<typeof rowToArtifact>[0] | undefined;
      return row ? rowToArtifact(row) : null;
    },
    listByWorkflow: async (workflowId) => {
      const rows = selectByWorkflow.all(workflowId) as Array<
        Parameters<typeof rowToArtifact>[0]
      >;
      return rows.map(rowToArtifact);
    },
    update: async (id, content) => {
      const existing = selectById.get(id) as
        | Parameters<typeof rowToArtifact>[0]
        | undefined;
      if (!existing) {
        throw new Error(`Artifact "${id}" not found.`);
      }
      updateContent.run(JSON.stringify(content), id);
      return rowToArtifact({ ...existing, content: JSON.stringify(content) });
    },
  };
};

export const createSqliteWorkflowRunStore = (
  db: SqliteDatabase,
): WorkflowRunStore => {
  const upsert = db.prepare(`
    INSERT INTO workflow_runs (id, snapshot, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      snapshot = excluded.snapshot,
      updated_at = excluded.updated_at
  `);
  const selectById = db.prepare(`SELECT snapshot FROM workflow_runs WHERE id = ?`);
  const selectAll = db.prepare(`
    SELECT snapshot FROM workflow_runs
    ORDER BY updated_at DESC
  `);

  return {
    save: async (snapshot: WorkflowRunSnapshot) => {
      upsert.run(snapshot.id, JSON.stringify(snapshot), snapshot.updatedAt);
    },
    getById: async (id) => {
      const row = selectById.get(id) as { snapshot: string } | undefined;
      return row ? (JSON.parse(row.snapshot) as WorkflowRunSnapshot) : null;
    },
    list: async () => {
      const rows = selectAll.all() as Array<{ snapshot: string }>;
      return rows.map((row) => JSON.parse(row.snapshot) as WorkflowRunSnapshot);
    },
  };
};

export interface SqliteStores {
  readonly db: SqliteDatabase;
  readonly artifactStore: ArtifactStore;
  readonly runStore: WorkflowRunStore;
}

export const createSqliteStores = (dbPath: string): SqliteStores => {
  const db = openSqliteDatabase(dbPath);
  return {
    db,
    artifactStore: createSqliteArtifactStore(db),
    runStore: createSqliteWorkflowRunStore(db),
  };
};
