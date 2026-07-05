import { describe, expect, it } from "vitest";
import { makeTestServices } from "../testing/test-services.js";
import { createAgentContext } from "./agent-context.js";
import { createAgentRunResult, type AgentRunResult } from "./agent-result.js";
import type { AgentServices } from "./agent-services.js";
import { AgentType } from "./agent-types.js";
import { BaseAgent } from "./base-agent.js";

class EchoAgent extends BaseAgent<string, { echoed: string }> {
  getDefaultSystemPrompt(): string {
    return "You are an echo agent.";
  }
  protected async executeTask(
    input: string,
  ): Promise<AgentRunResult<{ echoed: string }>> {
    const text = await this.ask(input);
    return createAgentRunResult({ summary: "echoed", output: { echoed: text } });
  }
}

class ThrowingAgent extends BaseAgent<void, never> {
  getDefaultSystemPrompt(): string {
    return "boom";
  }
  protected async executeTask(): Promise<AgentRunResult<never>> {
    throw new Error("kaboom");
  }
}

const makeEcho = (services: AgentServices = makeTestServices()) =>
  new EchoAgent({
    id: "agent-1",
    type: AgentType.Research,
    context: createAgentContext(),
    services,
  });

describe("BaseAgent lifecycle (AC-2)", () => {
  it("starts pending and reaches completed on success", async () => {
    const agent = makeEcho();
    expect(agent.status).toBe("pending");
    await agent.assignTask("hello");
    expect(agent.status).toBe("completed");
  });

  it("throws on an invalid transition (re-running a finished task)", async () => {
    const agent = makeEcho();
    await agent.assignTask("hello");
    await expect(agent.assignTask("again")).rejects.toThrow(
      /Invalid task transition/,
    );
  });
});

describe("BaseAgent failure handling (AC-3)", () => {
  it("marks the task failed and returns a failure result without throwing", async () => {
    const services = makeTestServices();
    const agent = new ThrowingAgent({
      id: "agent-2",
      type: AgentType.Qa,
      context: createAgentContext(),
      services,
    });
    const result = await agent.assignTask();
    expect(agent.status).toBe("failed");
    expect(result.status).toBe("failure");
    expect(result.summary).toContain("kaboom");
    expect(services.logger.entries.some((e) => e.level === "error")).toBe(true);
  });
});

describe("BaseAgent AI access (AC-4)", () => {
  it("uses only the injected AiClient, which captures the call", async () => {
    const services = makeTestServices({ defaultText: "world" });
    const agent = makeEcho(services);
    const result = await agent.assignTask("hello");
    expect(services.aiClient.callCount).toBe(1);
    expect(services.aiClient.calls[0]).toMatchObject({
      systemPrompt: "You are an echo agent.",
      prompt: "hello",
    });
    expect((result.output as { echoed: string }).echoed).toBe("world");
  });
});
