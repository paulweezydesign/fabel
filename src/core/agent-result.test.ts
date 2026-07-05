import { describe, expect, it } from "vitest";
import {
  createAgentRunResult,
  createFailureResult,
  isAgentRunResult,
} from "./agent-result.js";

describe("AgentRunResult (FR-3)", () => {
  it("defaults status to success and collections to empty arrays", () => {
    const result = createAgentRunResult({ summary: "did work", output: { a: 1 } });
    expect(result.status).toBe("success");
    expect(result.questions).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.output).toEqual({ a: 1 });
  });

  it("preserves provided questions and risks", () => {
    const result = createAgentRunResult({
      summary: "s",
      output: null,
      questions: ["q1"],
      risks: ["r1"],
    });
    expect(result.questions).toEqual(["q1"]);
    expect(result.risks).toEqual(["r1"]);
  });

  it("builds a failure result from an Error", () => {
    const result = createFailureResult(new Error("boom"));
    expect(result.status).toBe("failure");
    expect(result.summary).toContain("boom");
    expect(result.output).toEqual({ error: "boom" });
  });
});

describe("isAgentRunResult (runner-boundary validation, §8)", () => {
  it("accepts a well-formed result", () => {
    expect(
      isAgentRunResult(createAgentRunResult({ summary: "s", output: 1 })),
    ).toBe(true);
  });

  it("rejects malformed shapes", () => {
    expect(isAgentRunResult(null)).toBe(false);
    expect(isAgentRunResult({})).toBe(false);
    expect(isAgentRunResult({ status: "nope", summary: "s", output: 1 })).toBe(
      false,
    );
    expect(
      isAgentRunResult({ status: "success", summary: 1, output: 1, questions: [], risks: [] }),
    ).toBe(false);
    expect(
      isAgentRunResult({ status: "success", summary: "s", output: 1, questions: [1], risks: [] }),
    ).toBe(false);
    expect(
      isAgentRunResult({ status: "success", summary: "s", questions: [], risks: [] }),
    ).toBe(false);
  });
});
