/**
 * FR-1: Single source of truth for the V1 agent names.
 *
 * All code that refers to an agent by name must use this enum; string literals
 * for agent types anywhere else are a defect.
 */
export enum AgentType {
  ProjectManager = "project_manager",
  Research = "research",
  Designer = "designer",
  TechLead = "tech_lead",
  FullStackEngineer = "full_stack_engineer",
  Qa = "qa",
  ClientGrowth = "client_growth",
}

const AGENT_TYPE_VALUES: readonly AgentType[] = Object.freeze(
  Object.values(AgentType),
);

/** All V1 agent types, frozen so callers cannot mutate the source of truth. */
export const agentTypes = (): readonly AgentType[] => AGENT_TYPE_VALUES;

/** Type guard: narrows an arbitrary string to a known {@link AgentType}. */
export const isAgentType = (value: unknown): value is AgentType =>
  typeof value === "string" &&
  AGENT_TYPE_VALUES.includes(value as AgentType);
