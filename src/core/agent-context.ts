/**
 * Contextual data an agent can access during execution (FR-2).
 * Each id is optional depending on the workflow that spawned the agent.
 */
export interface AgentContext {
  readonly tenantId?: string;
  readonly projectId?: string;
  readonly leadId?: string;
}

const definedEntries = (context: AgentContext): AgentContext =>
  Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );

export const createAgentContext = (context: AgentContext): AgentContext =>
  Object.freeze(definedEntries(context));
