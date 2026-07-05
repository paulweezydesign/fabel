import { describe, expect, it, vi } from "vitest";
import { StubAiClient } from "./ai-client.js";
import {
  OpenAiClient,
  selectAiClient,
  type FetchImpl,
} from "./openai-ai-client.js";

/** Builds a mock `fetch` that returns the given JSON body + status. */
const mockJsonFetch = (body: unknown, init: { status?: number } = {}) =>
  vi.fn<FetchImpl>(
    async (_url, _requestInit) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  );

const okBody = {
  choices: [{ message: { role: "assistant", content: "hello world" } }],
};

describe("OpenAiClient", () => {
  it("builds the correct request (url, method, auth header, JSON body)", async () => {
    const fetchImpl = mockJsonFetch(okBody);
    const client = new OpenAiClient({
      apiKey: "sk-test",
      baseUrl: "https://example.test/v1",
      model: "gpt-test",
      fetchImpl,
    });

    await client.complete({ systemPrompt: "you are a bot", prompt: "hi" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-test");
    expect(headers.get("content-type")).toBe("application/json");

    const parsed = JSON.parse(String(init?.body));
    expect(parsed.model).toBe("gpt-test");
    expect(parsed.messages).toEqual([
      { role: "system", content: "you are a bot" },
      { role: "user", content: "hi" },
    ]);
  });

  it("parses assistant content into { text }", async () => {
    const client = new OpenAiClient({
      apiKey: "sk-test",
      fetchImpl: mockJsonFetch(okBody),
    });
    const res = await client.complete({ systemPrompt: "s", prompt: "p" });
    expect(res).toEqual({ text: "hello world" });
  });

  it("throws on non-2xx responses, including the status in the message", async () => {
    const client = new OpenAiClient({
      apiKey: "sk-test",
      fetchImpl: mockJsonFetch({ error: "nope" }, { status: 429 }),
    });
    await expect(
      client.complete({ systemPrompt: "s", prompt: "p" }),
    ).rejects.toThrow(/429/);
  });

  it("throws when the response is missing content", async () => {
    const client = new OpenAiClient({
      apiKey: "sk-test",
      fetchImpl: mockJsonFetch({ choices: [{ message: {} }] }),
    });
    await expect(
      client.complete({ systemPrompt: "s", prompt: "p" }),
    ).rejects.toThrow(/content/i);
  });

  it("uses the default base URL and model when not provided", async () => {
    const fetchImpl = mockJsonFetch(okBody);
    const client = new OpenAiClient({ apiKey: "sk-test", fetchImpl });
    await client.complete({ systemPrompt: "s", prompt: "p" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(String(init?.body)).model).toBe("gpt-4o-mini");
  });

  it("reads config from env when options are omitted", async () => {
    const fetchImpl = mockJsonFetch(okBody);
    const client = new OpenAiClient({
      env: {
        OPENAI_API_KEY: "sk-env",
        OPENAI_BASE_URL: "https://env.test/v1",
        OPENAI_MODEL: "env-model",
      },
      fetchImpl,
    });
    await client.complete({ systemPrompt: "s", prompt: "p" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://env.test/v1/chat/completions");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-env");
    expect(JSON.parse(String(init?.body)).model).toBe("env-model");
  });

  it("throws when constructed without an api key", () => {
    expect(() => new OpenAiClient({ env: {} })).toThrow(/OPENAI_API_KEY/);
  });
});

describe("selectAiClient", () => {
  it("returns an OpenAiClient when OPENAI_API_KEY is present", () => {
    const client = selectAiClient({ OPENAI_API_KEY: "sk-test" });
    expect(client).toBeInstanceOf(OpenAiClient);
  });

  it("returns a StubAiClient when OPENAI_API_KEY is absent", () => {
    const client = selectAiClient({});
    expect(client).toBeInstanceOf(StubAiClient);
  });
});
