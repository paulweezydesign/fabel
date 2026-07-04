import type { AgentRegistry } from '@/core/agent-factory';
import { AgentType } from '@/core/agent-types';
import { ProjectManagerAgent } from './project-manager-agent';
import { ResearchAgent } from './research-agent';
import { DesignerAgent } from './designer-agent';
import { TechLeadAgent } from './tech-lead-agent';
import { FullStackEngineerAgent } from './full-stack-engineer-agent';
import { QaAgent } from './qa-agent';
import { ClientGrowthAgent } from './client-growth-agent';

/**
 * Adding a new agent means adding its subclass and one line here — nothing
 * else changes (FR-8).
 */
export const defaultAgentRegistry: AgentRegistry = {
  [AgentType.ProjectManager]: ProjectManagerAgent,
  [AgentType.Research]: ResearchAgent,
  [AgentType.Designer]: DesignerAgent,
  [AgentType.TechLead]: TechLeadAgent,
  [AgentType.FullStackEngineer]: FullStackEngineerAgent,
  [AgentType.Qa]: QaAgent,
  [AgentType.ClientGrowth]: ClientGrowthAgent,
};
