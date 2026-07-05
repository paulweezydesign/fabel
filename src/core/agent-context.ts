/**
 * FR-2: The contextual data an agent may access during execution.
 *
 * Each field is optional because different workflows provide different context
 * (a lead-outreach flow has a `leadId`; an intake flow has a `projectId`).
 * Agents must not reach outside the context they are given.
 */
export interface AgentContext {
  readonly tenantId?: string;
  readonly projectId?: string;
  readonly leadId?: string;
}

/** Builds an {@link AgentContext}, defaulting to the single V1 tenant. */
export const createAgentContext = (
  overrides: AgentContext = {},
): AgentContext => Object.freeze({ tenantId: "default", ...overrides });
