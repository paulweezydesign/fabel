import { describe, expect, it } from "vitest";
import { ResearchAgent } from "../agents/research-agent.js";
import { makeTestServices } from "../testing/test-services.js";
import { createAgentContext } from "./agent-context.js";
import {
  AgentFactory,
  UnregisteredAgentTypeError,
  defaultAgentRegistry,
} from "./agent-factory.js";
import { AgentType, agentTypes } from "./agent-types.js";

describe("AgentFactory registration (AC-5)", () => {
  it("creates the correct subclass for every registered type", () => {
    const factory = new AgentFactory(makeTestServices());
    for (const type of agentTypes()) {
      const agent = factory.createAgent(type, createAgentContext());
      expect(agent.type).toBe(type);
    }
    expect(
      factory.createAgent(AgentType.Research, createAgentContext()),
    ).toBeInstanceOf(ResearchAgent);
  });

  it("assigns a unique id to each created agent", () => {
    const factory = new AgentFactory(makeTestServices());
    const a = factory.createAgent(AgentType.Qa, createAgentContext());
    const b = factory.createAgent(AgentType.Qa, createAgentContext());
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBeTypeOf("string");
  });

  it("injects the shared services (AI, bus, logger observable via a run)", async () => {
    const services = makeTestServices({ defaultText: "ok" });
    const factory = new AgentFactory(services);
    const agent = factory.createAgent(AgentType.Research, createAgentContext());
    await agent.assignTask({ prompt: "subject", priorArtifacts: [] });
    expect(services.aiClient.callCount).toBe(1);
    expect(services.messageBus.messages.length).toBeGreaterThan(0);
    expect(services.logger.entries.length).toBeGreaterThan(0);
  });
});

describe("AgentFactory unregistered types (AC-6, FR-7)", () => {
  it("throws a descriptive error naming the offending type", () => {
    const factory = new AgentFactory(makeTestServices(), new Map());
    expect(() =>
      factory.createAgent(AgentType.Designer, createAgentContext()),
    ).toThrow(UnregisteredAgentTypeError);
    expect(() =>
      factory.createAgent(AgentType.Designer, createAgentContext()),
    ).toThrow(/designer/);
  });
});

describe("AgentFactory extension (FR-8, US-6)", () => {
  it("registers a new agent and then creates it (<= 2 touch points)", () => {
    const factory = new AgentFactory(makeTestServices(), new Map());
    expect(factory.isRegistered(AgentType.Research)).toBe(false);
    factory.register(AgentType.Research, ResearchAgent);
    expect(factory.isRegistered(AgentType.Research)).toBe(true);
    expect(
      factory.createAgent(AgentType.Research, createAgentContext()),
    ).toBeInstanceOf(ResearchAgent);
  });

  it("default registry contains all seven agents", () => {
    expect(defaultAgentRegistry().size).toBe(7);
  });
});
