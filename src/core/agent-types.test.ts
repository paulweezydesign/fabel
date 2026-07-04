import { describe, expect, it } from 'vitest';
import { AGENT_TYPES, AgentType, isAgentType } from './agent-types';

describe('AgentType', () => {
  it('contains exactly the seven V1 agents (AC-1)', () => {
    expect([...AGENT_TYPES].sort()).toEqual(
      [
        'project_manager',
        'research',
        'designer',
        'tech_lead',
        'full_stack_engineer',
        'qa',
        'client_growth',
      ].sort(),
    );
  });

  it('exposes each agent as a named constant', () => {
    expect(AgentType.ProjectManager).toBe('project_manager');
    expect(AgentType.Research).toBe('research');
    expect(AgentType.Designer).toBe('designer');
    expect(AgentType.TechLead).toBe('tech_lead');
    expect(AgentType.FullStackEngineer).toBe('full_stack_engineer');
    expect(AgentType.Qa).toBe('qa');
    expect(AgentType.ClientGrowth).toBe('client_growth');
  });

  describe('isAgentType', () => {
    it.each([...AGENT_TYPES])('accepts %s', (type) => {
      expect(isAgentType(type)).toBe(true);
    });

    it.each(['', 'intern', 'PROJECT_MANAGER', 42, null, undefined, {}])(
      'rejects %s',
      (value) => {
        expect(isAgentType(value)).toBe(false);
      },
    );
  });
});
