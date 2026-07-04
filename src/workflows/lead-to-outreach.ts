import { AgentType } from '@/core/agent-types';
import type { WorkflowDefinition } from '@/core/workflow-runner';

/**
 * Lead → Outreach (FR-17): the Research Agent summarises a prospect's
 * business and the Client Growth Agent drafts a personalised outreach plan.
 * The approval gate ensures the outreach message reflects the agency's tone.
 */
export const leadToOutreachWorkflow = (projectId: string): WorkflowDefinition => ({
  id: 'lead-to-outreach',
  name: 'Lead → Outreach',
  projectId,
  steps: [
    {
      id: 'research-prospect',
      title: "Summarise the prospect's business",
      agentType: AgentType.Research,
    },
    {
      id: 'draft-outreach',
      title: 'Draft a personalised outreach plan',
      agentType: AgentType.ClientGrowth,
      dependsOn: ['research-prospect'],
      requiresApproval: true,
    },
  ],
});
