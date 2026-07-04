import { describe, expect, it } from 'vitest';
import { AgentType } from '@/core/agent-types';
import { createAgentFactory } from '@/core/agent-factory';
import { createInMemoryArtifactStore } from '@/core/artifact-store';
import { createWorkflowRun, type WorkflowDefinition } from '@/core/workflow-runner';
import { defaultAgentRegistry } from '@/agents/registry';
import {
  createRecordingLogger,
  createRecordingMessageBus,
  createStubAiClient,
} from '@/testing/doubles';
import { leadToOutreachWorkflow } from './lead-to-outreach';
import { intakeToProjectBriefWorkflow } from './intake-to-project-brief';
import { briefToBuildPlanWorkflow } from './brief-to-build-plan';

/**
 * End-to-end runs of the three V1 workflows with a stubbed AiClient
 * returning canned structured outputs (AC-16).
 */
const runWorkflowToCompletion = async (definition: WorkflowDefinition) => {
  const artifactStore = createInMemoryArtifactStore();
  const factory = createAgentFactory({
    registry: defaultAgentRegistry,
    services: {
      ai: createStubAiClient(() =>
        JSON.stringify({ summary: 'stubbed work', detail: 'canned output' }),
      ),
      logger: createRecordingLogger(),
      messageBus: createRecordingMessageBus(),
    },
  });
  const run = createWorkflowRun({
    definition,
    factory,
    artifactStore,
    logger: createRecordingLogger(),
  });

  await run.start({ client: 'Acme Corp' });
  return { run, artifactStore };
};

describe('Lead → Outreach workflow (FR-17)', () => {
  it('researches, drafts outreach, then pauses for tone approval', async () => {
    const definition = leadToOutreachWorkflow('proj-1');
    const { run, artifactStore } = await runWorkflowToCompletion(definition);

    expect(run.status).toBe('needs_review');
    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts.map((a) => a.agentType)).toEqual([
      AgentType.Research,
      AgentType.ClientGrowth,
    ]);

    await run.approve(run.pendingApprovalStepId!);
    expect(run.status).toBe('completed');
  });
});

describe('Intake → Project Brief workflow (FR-18)', () => {
  it('summarises goals, adds market context, composes a brief needing approval', async () => {
    const definition = intakeToProjectBriefWorkflow('proj-1');
    const { run, artifactStore } = await runWorkflowToCompletion(definition);

    expect(run.status).toBe('needs_review');
    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts.map((a) => a.agentType)).toEqual([
      AgentType.ProjectManager,
      AgentType.Research,
      AgentType.ProjectManager,
    ]);

    await run.approve(run.pendingApprovalStepId!);
    expect(run.status).toBe('completed');
  });
});

describe('Brief → Build Plan workflow (FR-19)', () => {
  it('proposes design, outlines the build, creates a QA checklist, gates before implementation', async () => {
    const definition = briefToBuildPlanWorkflow('proj-1');
    const { run, artifactStore } = await runWorkflowToCompletion(definition);

    expect(run.status).toBe('needs_review');
    const artifacts = await artifactStore.listByWorkflow(run.id);
    expect(artifacts.map((a) => a.agentType)).toEqual([
      AgentType.Designer,
      AgentType.TechLead,
      AgentType.Qa,
    ]);

    await run.approve(run.pendingApprovalStepId!);
    expect(run.status).toBe('completed');
  });
});

describe('workflow definitions', () => {
  it.each([
    ['lead-to-outreach', leadToOutreachWorkflow],
    ['intake-to-project-brief', intakeToProjectBriefWorkflow],
    ['brief-to-build-plan', briefToBuildPlanWorkflow],
  ])('%s is strictly sequential with a final approval gate', (_name, build) => {
    const definition = build('proj-1');
    const lastStep = definition.steps[definition.steps.length - 1];

    expect(lastStep.requiresApproval).toBe(true);
    // every step after the first depends on exactly the previous step
    definition.steps.slice(1).forEach((step, index) => {
      expect(step.dependsOn).toEqual([definition.steps[index].id]);
    });
    expect(definition.projectId).toBe('proj-1');
  });
});
