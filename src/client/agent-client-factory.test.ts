import { describe, expect, it, vi } from "vitest";
import { AgentType } from "../core/agent-types.js";
import { AgentClientError, createAgentClient } from "./agent-client-factory.js";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("createAgentClient (FR-16, AC-14)", () => {
  it("posts to /api/agents/:type/run and returns the parsed result", async () => {
    const result = { status: "success", summary: "ok", output: {}, questions: [], risks: [] };
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse(200, result),
    );
    const client = createAgentClient(AgentType.Research, {
      baseUrl: "http://api.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await client.run({ prompt: "Acme", priorArtifacts: [] });

    expect(res).toEqual(result);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/agents/research/run");
    expect(init?.method).toBe("POST");
    // No credentials appear in the request payload (AC-14).
    expect(JSON.parse(init?.body as string)).toEqual({
      prompt: "Acme",
      priorArtifacts: [],
    });
  });
});

describe("createAgentClient error handling (AC-15)", () => {
  it("surfaces a non-2xx response as a structured AgentClientError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(404, { error: "Unknown agent type: wizard" }),
    );
    const client = createAgentClient(AgentType.Research, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.run({ prompt: "x", priorArtifacts: [] })).rejects.toEqual(
      expect.objectContaining({
        name: "AgentClientError",
        status: 404,
        message: "Unknown agent type: wizard",
      }),
    );
  });

  it("still throws AgentClientError when the error body is not JSON", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("gateway timeout", { status: 504 }),
    );
    const client = createAgentClient(AgentType.Qa, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await client
      .run({ prompt: "x", priorArtifacts: [] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AgentClientError);
    expect((error as AgentClientError).status).toBe(504);
  });
});
