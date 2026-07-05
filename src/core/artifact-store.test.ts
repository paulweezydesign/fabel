import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AgentType } from "./agent-types.js";
import {
  FileArtifactStore,
  InMemoryArtifactStore,
  type ArtifactInput,
  type ArtifactStore,
} from "./artifact-store.js";

const sampleInput = (overrides: Partial<ArtifactInput> = {}): ArtifactInput => ({
  workflowId: "wf-1",
  projectId: "proj-1",
  agentType: AgentType.Research,
  title: "Research summary",
  content: { facts: ["a", "b"] },
  ...overrides,
});

/**
 * AC-12/AC-13: one interface suite, run unchanged against every implementation.
 */
const runContract = (name: string, makeStore: () => ArtifactStore): void => {
  describe(`ArtifactStore contract: ${name}`, () => {
    it("round-trips an artifact by id with all fields intact (AC-12)", async () => {
      const store = makeStore();
      const input = sampleInput();
      const saved = await store.save(input);
      expect(saved.id).toBeTypeOf("string");
      expect(saved).toMatchObject(input);

      const fetched = await store.getById(saved.id);
      expect(fetched).toEqual(saved);
    });

    it("returns undefined for an unknown id", async () => {
      const store = makeStore();
      expect(await store.getById("missing")).toBeUndefined();
    });

    it("retrieves all artifacts for a workflow and excludes others (AC-12)", async () => {
      const store = makeStore();
      const a = await store.save(sampleInput({ title: "A" }));
      const b = await store.save(sampleInput({ title: "B" }));
      await store.save(sampleInput({ workflowId: "other", title: "C" }));

      const forWf1 = await store.getByWorkflowId("wf-1");
      expect(forWf1).toHaveLength(2);
      expect(new Set(forWf1.map((x) => x.id))).toEqual(new Set([a.id, b.id]));
    });

    it("returns an empty list for a workflow with no artifacts", async () => {
      const store = makeStore();
      expect(await store.getByWorkflowId("none")).toEqual([]);
    });
  });
};

runContract("InMemoryArtifactStore", () => new InMemoryArtifactStore());

describe("FileArtifactStore", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });
  runContract("FileArtifactStore", () => {
    const dir = join(tmpdir(), `fabel-artifacts-${Math.random().toString(36).slice(2)}`);
    dirs.push(dir);
    return new FileArtifactStore(dir);
  });
});

describe("InMemoryArtifactStore ordering", () => {
  it("preserves save order for a workflow (AC-16 sequence)", async () => {
    const store = new InMemoryArtifactStore();
    await store.save(sampleInput({ title: "first" }));
    await store.save(sampleInput({ title: "second" }));
    const [a, b] = await store.getByWorkflowId("wf-1");
    expect([a?.title, b?.title]).toEqual(["first", "second"]);
  });
});
