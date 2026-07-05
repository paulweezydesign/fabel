import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentType } from "./agent-types.js";

/**
 * FR-12: A stored, structured agent output.
 *
 * The interface deliberately hides storage details (FR-13) so a database-backed
 * implementation can replace these later without touching agents or the runner.
 */
export interface Artifact {
  readonly id: string;
  readonly workflowId: string;
  readonly projectId?: string;
  readonly agentType: AgentType;
  readonly title: string;
  readonly content: unknown;
}

export type ArtifactInput = Omit<Artifact, "id">;

export interface ArtifactStore {
  /** Persists an artifact, assigning and returning its generated `id`. */
  save(input: ArtifactInput): Promise<Artifact>;
  getById(id: string): Promise<Artifact | undefined>;
  /** Retrieves every artifact for a workflow, in save order (FR-14, US-4). */
  getByWorkflowId(workflowId: string): Promise<readonly Artifact[]>;
}

/** Raised when a store cannot persist or read an artifact (§8). */
export class ArtifactStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ArtifactStoreError";
  }
}

const withId = (input: ArtifactInput): Artifact => ({
  id: randomUUID(),
  ...input,
});

/** FR-13: default in-memory implementation. */
export class InMemoryArtifactStore implements ArtifactStore {
  private readonly byId = new Map<string, Artifact>();
  private readonly order: string[] = [];

  async save(input: ArtifactInput): Promise<Artifact> {
    const artifact = withId(input);
    this.byId.set(artifact.id, artifact);
    this.order.push(artifact.id);
    return artifact;
  }

  async getById(id: string): Promise<Artifact | undefined> {
    return this.byId.get(id);
  }

  async getByWorkflowId(workflowId: string): Promise<readonly Artifact[]> {
    return this.order
      .map((id) => this.byId.get(id))
      .filter(
        (a): a is Artifact => a !== undefined && a.workflowId === workflowId,
      );
  }
}

/**
 * FR-13: optional file-based implementation behind the same interface.
 * Artifacts are stored as one JSON file per artifact so the directory is easy
 * to inspect. Unwritable paths surface as {@link ArtifactStoreError} (§8).
 */
export class FileArtifactStore implements ArtifactStore {
  private ready?: Promise<void>;

  constructor(private readonly directory: string) {}

  private async ensureDir(): Promise<void> {
    this.ready ??= mkdir(this.directory, { recursive: true }).then(
      () => undefined,
    );
    await this.ready;
  }

  private pathFor(id: string): string {
    return join(this.directory, `${id}.json`);
  }

  async save(input: ArtifactInput): Promise<Artifact> {
    const artifact = withId(input);
    try {
      await this.ensureDir();
      await writeFile(
        this.pathFor(artifact.id),
        JSON.stringify(artifact, null, 2),
        "utf8",
      );
    } catch (cause) {
      throw new ArtifactStoreError(
        `Failed to persist artifact ${artifact.id}`,
        { cause },
      );
    }
    return artifact;
  }

  async getById(id: string): Promise<Artifact | undefined> {
    try {
      const raw = await readFile(this.pathFor(id), "utf8");
      return JSON.parse(raw) as Artifact;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new ArtifactStoreError(`Failed to read artifact ${id}`, { cause });
    }
  }

  async getByWorkflowId(workflowId: string): Promise<readonly Artifact[]> {
    try {
      await this.ensureDir();
      const files = (await readdir(this.directory))
        .filter((f) => f.endsWith(".json"))
        .sort();
      const artifacts = await Promise.all(
        files.map(async (file) => {
          const raw = await readFile(join(this.directory, file), "utf8");
          return JSON.parse(raw) as Artifact;
        }),
      );
      return artifacts.filter((a) => a.workflowId === workflowId);
    } catch (cause) {
      throw new ArtifactStoreError(
        `Failed to list artifacts for workflow ${workflowId}`,
        { cause },
      );
    }
  }
}
