import { AgentType } from '@/core/agent-types';
import type { WorkflowDefinition } from '@/core/workflow-runner';

/**
 * Intake → Project Brief (FR-18): the Project Manager summarises client
 * goals, the Research Agent adds market context and the Project Manager
 * composes a brief that requires approval.
 */
export const intakeToProjectBriefWorkflow = (
  projectId: string,
): WorkflowDefinition => ({
  id: 'intake-to-project-brief',
  name: 'Intake → Project Brief',
  projectId,
  steps: [
    {
      id: 'summarise-goals',
      title: 'Summarise client goals',
      agentType: AgentType.ProjectManager,
    },
    {
      id: 'market-context',
      title: 'Add market context',
      agentType: AgentType.Research,
      dependsOn: ['summarise-goals'],
    },
    {
      id: 'compose-brief',
      title: 'Compose the project brief',
      agentType: AgentType.ProjectManager,
      dependsOn: ['market-context'],
      requiresApproval: true,
    },
  ],
});
