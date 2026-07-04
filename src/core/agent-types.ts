/**
 * Single source of truth for valid agent names (FR-1).
 * A const object rather than a TS enum keeps the values usable as a plain
 * string union and iterable at runtime.
 */
export const AgentType = {
  ProjectManager: 'project_manager',
  Research: 'research',
  Designer: 'designer',
  TechLead: 'tech_lead',
  FullStackEngineer: 'full_stack_engineer',
  Qa: 'qa',
  ClientGrowth: 'client_growth',
} as const;

export type AgentType = (typeof AgentType)[keyof typeof AgentType];

export const AGENT_TYPES: readonly AgentType[] = Object.freeze(
  Object.values(AgentType),
);

export const isAgentType = (value: unknown): value is AgentType =>
  typeof value === 'string' && (AGENT_TYPES as readonly string[]).includes(value);
