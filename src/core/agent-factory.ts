import { randomUUID } from 'node:crypto';
import type { AgentContext } from './agent-context';
import { isAgentType, type AgentType } from './agent-types';
import type { AgentServices, BaseAgent, BaseAgentInit } from './base-agent';

export type AgentConstructor = new (init: BaseAgentInit) => BaseAgent;

/**
 * Maps each AgentType to its constructor (FR-6). Partial so registries can
 * be built incrementally; unregistered types fail fast (FR-7).
 */
export type AgentRegistry = Partial<Record<AgentType, AgentConstructor>>;

export interface AgentFactory {
  createAgent(type: AgentType, context: AgentContext): BaseAgent;
}

interface AgentFactoryInit {
  registry: AgentRegistry;
  services: AgentServices;
  generateId?: () => string;
}

export const createAgentFactory = ({
  registry,
  services,
  generateId = randomUUID,
}: AgentFactoryInit): AgentFactory => ({
  createAgent: (type, context) => {
    if (!isAgentType(type)) {
      throw new Error(`"${type}" is not a valid agent type.`);
    }
    const Ctor = registry[type];
    if (!Ctor) {
      throw new Error(`No agent registered for type "${type}".`);
    }
    return new Ctor({ id: generateId(), type, context, services });
  },
});
