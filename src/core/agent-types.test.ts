import { describe, expect, it } from "vitest";
import { AgentType, agentTypes, isAgentType } from "./agent-types.js";

describe("AgentType (FR-1, AC-1)", () => {
  it("contains exactly the seven V1 agents", () => {
    expect(agentTypes()).toHaveLength(7);
    expect(new Set(agentTypes())).toEqual(
      new Set([
        "project_manager",
        "research",
        "designer",
        "tech_lead",
        "full_stack_engineer",
        "qa",
        "client_growth",
      ]),
    );
  });

  it("recognises every known agent type", () => {
    for (const type of agentTypes()) {
      expect(isAgentType(type)).toBe(true);
    }
  });

  it("rejects values outside the enum", () => {
    expect(isAgentType("not_an_agent")).toBe(false);
    expect(isAgentType("")).toBe(false);
    expect(isAgentType(undefined)).toBe(false);
    expect(isAgentType(42)).toBe(false);
  });

  it("exposes an immutable list", () => {
    const list = agentTypes();
    expect(() => {
      (list as AgentType[]).push(AgentType.Qa);
    }).toThrow();
  });
});
