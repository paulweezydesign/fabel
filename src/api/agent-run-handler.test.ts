import { describe, expect, it } from "vitest";
import { AgentFactory } from "../core/agent-factory.js";
import { AgentType } from "../core/agent-types.js";
import { makeTestServices } from "../testing/test-services.js";
import { handleAgentRun } from "./agent-run-handler.js";

const deps = (aiOptions?: Parameters<typeof makeTestServices>[0]) => ({
  factory: new AgentFactory(makeTestServices(aiOptions)),
});

describe("handleAgentRun (FR-15, §8, AC-15)", () => {
  it("returns 200 with the agent result on success", async () => {
    const res = await handleAgentRun(
      AgentType.Research,
      { prompt: "Acme" },
      deps({ defaultText: "- fact" }),
    );
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe("success");
  });

  it("returns 404 for an unknown agent type", async () => {
    const res = await handleAgentRun("wizard", { prompt: "x" }, deps());
    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toContain("wizard");
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await handleAgentRun(AgentType.Qa, {}, deps());
    expect(res.status).toBe(400);
  });

  it("returns 422 when the agent reports failure", async () => {
    const res = await handleAgentRun(
      AgentType.Research,
      { prompt: "x" },
      deps({
        responder: () => {
          throw new Error("provider down");
        },
      }),
    );
    expect(res.status).toBe(422);
    expect((res.body as { status: string }).status).toBe("failure");
  });
});
