import { describe, expect, it } from "vitest";
import { StubAiClient } from "./ai-client.js";

describe("StubAiClient (AC-4, §9)", () => {
  it("records every request in call order", async () => {
    const client = new StubAiClient();
    await client.complete({ systemPrompt: "sys", prompt: "one" });
    await client.complete({ systemPrompt: "sys", prompt: "two" });
    expect(client.callCount).toBe(2);
    expect(client.calls.map((c) => c.prompt)).toEqual(["one", "two"]);
  });

  it("returns fixed default text when configured", async () => {
    const client = new StubAiClient({ defaultText: "canned" });
    const res = await client.complete({ systemPrompt: "s", prompt: "p" });
    expect(res.text).toBe("canned");
  });

  it("delegates to a custom responder", async () => {
    const client = new StubAiClient({
      responder: (req) => `echo:${req.prompt}`,
    });
    const res = await client.complete({ systemPrompt: "s", prompt: "hi" });
    expect(res.text).toBe("echo:hi");
  });
});
