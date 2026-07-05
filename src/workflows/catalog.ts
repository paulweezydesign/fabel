import type { WorkflowDefinition } from '@/core/workflow-runner';
import { briefToBuildPlanWorkflow } from './brief-to-build-plan';
import { intakeToProjectBriefWorkflow } from './intake-to-project-brief';
import { leadToOutreachWorkflow } from './lead-to-outreach';

export const WORKFLOW_IDS = [
  'lead-to-outreach',
  'intake-to-project-brief',
  'brief-to-build-plan',
] as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[number];

export interface WorkflowDefinitionMeta {
  readonly id: WorkflowId;
  readonly name: string;
}

export const isWorkflowId = (value: string): value is WorkflowId =>
  (WORKFLOW_IDS as readonly string[]).includes(value);

export const resolveWorkflowDefinition = (
  id: WorkflowId,
  projectId: string,
): WorkflowDefinition => {
  switch (id) {
    case 'lead-to-outreach':
      return leadToOutreachWorkflow(projectId);
    case 'intake-to-project-brief':
      return intakeToProjectBriefWorkflow(projectId);
    case 'brief-to-build-plan':
      return briefToBuildPlanWorkflow(projectId);
  }
};

export const listWorkflowDefinitionMeta = (): WorkflowDefinitionMeta[] =>
  WORKFLOW_IDS.map((id) => {
    const definition = resolveWorkflowDefinition(id, 'template');
    return { id, name: definition.name };
  });
