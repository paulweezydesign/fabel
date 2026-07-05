import { describe, expect, it } from "vitest";
import { AgentType } from "../core/agent-types.js";
import type { Artifact } from "../core/artifact-store.js";
import { latestOutputFrom, toBullets } from "./agent-helpers.js";

describe("toBullets", () => {
  it("strips list markers and drops blank lines", () => {
    expect(toBullets("- one\n* two\n1. three\n\n   \n4) four")).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
  });
});

describe("latestOutputFrom", () => {
  const artifact = (agentType: AgentType, content: unknown): Artifact => ({
    id: crypto.randomUUID(),
    workflowId: "wf",
    agentType,
    title: "t",
    content,
  });

  it("returns the most recent artifact content for the agent type", () => {
    const artifacts = [
      artifact(AgentType.Research, { v: 1 }),
      artifact(AgentType.Research, { v: 2 }),
      artifact(AgentType.Designer, { v: 3 }),
    ];
    expect(latestOutputFrom(artifacts, AgentType.Research)).toEqual({ v: 2 });
  });

  it("returns undefined when no matching artifact exists", () => {
    expect(latestOutputFrom([], AgentType.Qa)).toBeUndefined();
  });
});
