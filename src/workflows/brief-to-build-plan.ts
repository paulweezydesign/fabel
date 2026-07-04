import { AgentType } from '@/core/agent-types';
import type { WorkflowDefinition } from '@/core/workflow-runner';

/**
 * Brief → Build Plan (FR-19): the Designer proposes a visual direction, the
 * Tech Lead outlines a build plan and the QA Agent creates a QA checklist,
 * with a final approval step before implementation.
 */
export const briefToBuildPlanWorkflow = (projectId: string): WorkflowDefinition => ({
  id: 'brief-to-build-plan',
  name: 'Brief → Build Plan',
  projectId,
  steps: [
    {
      id: 'visual-direction',
      title: 'Propose a visual direction',
      agentType: AgentType.Designer,
    },
    {
      id: 'build-plan',
      title: 'Outline the build plan',
      agentType: AgentType.TechLead,
      dependsOn: ['visual-direction'],
    },
    {
      id: 'qa-checklist',
      title: 'Create the QA checklist',
      agentType: AgentType.Qa,
      dependsOn: ['build-plan'],
      requiresApproval: true,
    },
  ],
});
