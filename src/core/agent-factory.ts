import { randomUUID } from "node:crypto";
import { ClientGrowthAgent } from "../agents/client-growth-agent.js";
import { DesignerAgent } from "../agents/designer-agent.js";
import { FullStackEngineerAgent } from "../agents/full-stack-engineer-agent.js";
import { ProjectManagerAgent } from "../agents/project-manager-agent.js";
import { QaAgent } from "../agents/qa-agent.js";
import { ResearchAgent } from "../agents/research-agent.js";
import { TechLeadAgent } from "../agents/tech-lead-agent.js";
import type { AgentContext } from "./agent-context.js";
import type { AgentServices } from "./agent-services.js";
import { AgentType } from "./agent-types.js";
import { BaseAgent, type BaseAgentParams } from "./base-agent.js";

export type AgentConstructor = new (params: BaseAgentParams) => BaseAgent;

/** Raised when an agent type has no registered constructor (FR-7, §8). */
export class UnregisteredAgentTypeError extends Error {
  constructor(readonly agentType: string) {
    super(`No agent registered for type: ${agentType}`);
    this.name = "UnregisteredAgentTypeError";
  }
}

/** The V1 agent registry (FR-6): one constructor per {@link AgentType}. */
export const defaultAgentRegistry = (): Map<AgentType, AgentConstructor> =>
  new Map<AgentType, AgentConstructor>([
    [AgentType.ProjectManager, ProjectManagerAgent],
    [AgentType.Research, ResearchAgent],
    [AgentType.Designer, DesignerAgent],
    [AgentType.TechLead, TechLeadAgent],
    [AgentType.FullStackEngineer, FullStackEngineerAgent],
    [AgentType.Qa, QaAgent],
    [AgentType.ClientGrowth, ClientGrowthAgent],
  ]);

/**
 * FR-6: centralised instantiation. Maps each {@link AgentType} to its
 * constructor and injects the shared services uniformly, so adding an agent
 * only requires a subclass plus one registry entry (FR-8, US-6).
 */
export class AgentFactory {
  private readonly registry: Map<AgentType, AgentConstructor>;

  constructor(
    private readonly services: AgentServices,
    registry: Map<AgentType, AgentConstructor> = defaultAgentRegistry(),
  ) {
    this.registry = registry;
  }

  register(type: AgentType, constructor: AgentConstructor): this {
    this.registry.set(type, constructor);
    return this;
  }

  isRegistered(type: AgentType): boolean {
    return this.registry.has(type);
  }

  /** FR-6/FR-7: create an agent with a unique id and injected services. */
  createAgent(type: AgentType, context: AgentContext): BaseAgent {
    const Constructor = this.registry.get(type);
    if (!Constructor) {
      throw new UnregisteredAgentTypeError(type);
    }
    return new Constructor({
      id: randomUUID(),
      type,
      context,
      services: this.services,
    });
  }
}
