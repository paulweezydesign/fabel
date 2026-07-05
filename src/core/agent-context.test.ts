import { describe, expect, it } from "vitest";
import { createAgentContext } from "./agent-context.js";

describe("AgentContext (FR-2)", () => {
  it("defaults to the single V1 tenant", () => {
    expect(createAgentContext()).toEqual({ tenantId: "default" });
  });

  it("carries provided project and lead IDs", () => {
    const ctx = createAgentContext({ projectId: "p1", leadId: "l1" });
    expect(ctx).toEqual({ tenantId: "default", projectId: "p1", leadId: "l1" });
  });

  it("allows overriding the tenant", () => {
    expect(createAgentContext({ tenantId: "acme" }).tenantId).toBe("acme");
  });

  it("is immutable", () => {
    const ctx = createAgentContext();
    expect(() => {
      (ctx as { tenantId?: string }).tenantId = "mutated";
    }).toThrow();
  });
});
