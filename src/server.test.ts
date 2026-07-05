import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createAgentServer } from "./server.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createAgentServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

const post = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("HTTP server end-to-end (FR-15, AC-14/AC-16 over HTTP)", () => {
  it("runs a single agent via POST /api/agents/:type/run", async () => {
    const res = await post("/api/agents/research/run", { prompt: "Acme Corp" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("success");
  });

  it("404s an unknown agent type with a structured error", async () => {
    const res = await post("/api/agents/wizard/run", { prompt: "x" });
    expect(res.status).toBe(404);
    expect((await res.json()) as { error: string }).toHaveProperty("error");
  });

  it("drives Lead → Outreach to the gate and completes after API approval", async () => {
    const startRes = await post("/api/workflows/lead-to-outreach/start", {
      workflowInput: { prospect: "Acme Corp" },
      projectId: "proj-http",
    });
    expect(startRes.status).toBe(200);
    const started = (await startRes.json()) as {
      workflowId: string;
      status: string;
      pausedStepId: string;
    };
    expect(started.status).toBe("needs_review");
    expect(started.pausedStepId).toBe("outreach");

    const artifactsRes = await fetch(
      `${baseUrl}/api/artifacts/${started.workflowId}`,
    );
    const artifacts = (await artifactsRes.json()) as Array<{ title: string }>;
    expect(artifacts.map((a) => a.title)).toEqual([
      "Research prospect",
      "Draft outreach plan",
    ]);

    const approveRes = await post(
      `/api/workflows/${started.workflowId}/approve`,
      { stepId: "outreach" },
    );
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()) as { status: string }).toMatchObject({
      status: "completed",
    });
  });
});
