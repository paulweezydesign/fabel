import { describe, expect, it } from 'vitest';
import { createAgentContext } from './agent-context';

describe('createAgentContext', () => {
  it('builds a context with tenant, project and lead ids (FR-2)', () => {
    const context = createAgentContext({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      leadId: 'lead-1',
    });

    expect(context).toEqual({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      leadId: 'lead-1',
    });
  });

  it('allows partial context — each id is optional depending on workflow', () => {
    expect(createAgentContext({ tenantId: 'tenant-1' })).toEqual({
      tenantId: 'tenant-1',
    });
    expect(createAgentContext({})).toEqual({});
  });

  it('returns a frozen object so agents cannot mutate their context', () => {
    const context = createAgentContext({ tenantId: 'tenant-1' });
    expect(Object.isFrozen(context)).toBe(true);
  });
});
