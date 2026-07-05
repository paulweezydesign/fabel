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

describe("Approval UI static file serving", () => {
  it("serves index.html at GET / with an HTML content-type", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!doctype html>");
  });

  it("serves app.js with a JavaScript content-type", async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("answers HEAD /app.js (curl -I) with 200 and no body", async () => {
    const res = await fetch(`${baseUrl}/app.js`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    expect(await res.text()).toBe("");
  });

  it("serves styles.css with a CSS content-type", async () => {
    const res = await fetch(`${baseUrl}/styles.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("rejects encoded path-traversal without leaking file contents", async () => {
    const res = await fetch(`${baseUrl}/..%2f..%2fpackage.json`);
    expect(res.status).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain('"name": "fabel"');
  });

  it("rejects traversal that escapes the web root", async () => {
    const res = await fetch(`${baseUrl}/..%2f..%2fserver.ts`, {
      redirect: "manual",
    });
    expect(res.status).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain("createAgentServer");
  });

  it("404s an unknown static asset without leaving the API contract", async () => {
    const res = await fetch(`${baseUrl}/does-not-exist.js`);
    expect(res.status).toBe(404);
  });
});
