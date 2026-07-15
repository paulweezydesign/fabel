import { describe, expect, it } from 'vitest';
import type { Artifact } from '@/core/artifact-store';
import { AgentType } from '@/core/agent-types';
import type { WorkflowRunSnapshot } from '@/core/workflow-runner';
import { resolveWorkflowDefinition } from '@/workflows/catalog';
import {
  extractReviewContent,
  formatApprovalToast,
  formatRejectionToast,
  getGatedArtifact,
} from './approval-ui';

const definition = resolveWorkflowDefinition('lead-to-outreach', 'proj-1');

const outreachArtifact = (content: unknown): Artifact => ({
  id: 'art-1',
  workflowId: 'run-1',
  projectId: 'proj-1',
  agentType: AgentType.ClientGrowth,
  title: 'Draft a personalised outreach plan',
  content,
  createdAt: '2026-07-05T10:01:00.000Z',
  sequence: 1,
});

const approvedRun = (overrides: Partial<WorkflowRunSnapshot> = {}): WorkflowRunSnapshot => ({
  id: 'run-1',
  definitionId: 'lead-to-outreach',
  projectId: 'proj-1',
  status: 'running',
  startedAt: '2026-07-05T10:00:00.000Z',
  pendingApprovalStepId: null,
  error: null,
  stepStatuses: {
    'research-prospect': 'completed',
    'draft-outreach': 'completed',
  },
  approvedStepIds: ['draft-outreach'],
  workflowInput: { leadName: 'Acme' },
  createdAt: '2026-07-05T10:00:00.000Z',
  updatedAt: '2026-07-05T10:02:00.000Z',
  ...overrides,
});

describe('getGatedArtifact', () => {
  it('returns the artifact for the pending approval step', () => {
    const research = outreachArtifact({ summary: 'Research', output: {} });
    const outreach = outreachArtifact({
      status: 'success',
      summary: 'Outreach draft ready',
      output: { message: 'Hi Acme' },
      questions: [],
      risks: [],
    });

    const found = getGatedArtifact(
      [
        { ...research, title: "Summarise the prospect's business", agentType: AgentType.Research },
        outreach,
      ],
      'draft-outreach',
      definition,
    );

    expect(found).toBe(outreach);
  });

  it('returns null when there is no pending step', () => {
    expect(getGatedArtifact([outreachArtifact({})], null, definition)).toBeNull();
  });

  it('returns null when no artifact matches the gated step', () => {
    expect(
      getGatedArtifact(
        [
          {
            ...outreachArtifact({}),
            title: 'Unrelated',
            agentType: AgentType.Research,
          },
        ],
        'draft-outreach',
        definition,
      ),
    ).toBeNull();
  });
});

describe('extractReviewContent', () => {
  it('surfaces outreach message prominently when present', () => {
    const review = extractReviewContent(
      outreachArtifact({
        status: 'success',
        summary: 'Drafted outreach for Acme',
        output: {
          message: 'Hi Acme — loved your recent launch.',
          subject: 'Quick idea for Acme’s Q3 site',
          nextSteps: ['Send email', 'Follow up on LinkedIn'],
        },
        questions: [],
        risks: [],
      }),
    );

    expect(review).toMatchObject({
      kind: 'outreach_message',
      headline: 'Hi Acme — loved your recent launch.',
      detail: 'Drafted outreach for Acme',
    });
    expect(review?.sections).toEqual([
      { label: 'Subject', value: 'Quick idea for Acme’s Q3 site' },
      { label: 'Next steps', value: ['Send email', 'Follow up on LinkedIn'] },
    ]);
  });

  it('surfaces a project brief for intake approval gates', () => {
    const review = extractReviewContent(
      outreachArtifact({
        status: 'success',
        summary: 'Project brief composed',
        output: {
          briefTitle: 'Acme Q3 ecommerce rebuild',
          brief: 'Rebuild the storefront for a Q3 launch with Shopify.',
          goals: ['Migrate catalog', 'Improve conversion'],
          scope: ['Theme + checkout UX'],
          outOfScope: ['ERP integration'],
          blockers: ['Brand assets incomplete'],
        },
        questions: [],
        risks: [],
      }),
    );

    expect(review).toMatchObject({
      kind: 'project_brief',
      headline: 'Acme Q3 ecommerce rebuild',
      detail: 'Rebuild the storefront for a Q3 launch with Shopify.',
    });
    expect(review?.sections).toEqual(
      expect.arrayContaining([
        { label: 'Goals', value: ['Migrate catalog', 'Improve conversion'] },
        { label: 'Scope', value: ['Theme + checkout UX'] },
        { label: 'Out of scope', value: ['ERP integration'] },
        { label: 'Blockers', value: ['Brand assets incomplete'] },
      ]),
    );
  });

  it('surfaces QA checklist content for build-plan approval gates', () => {
    const review = extractReviewContent(
      outreachArtifact({
        status: 'success',
        summary: 'QA checklist ready before implementation',
        output: {
          checklist: ['Mobile checkout', 'Empty cart state'],
          acceptanceCriteria: ['Lighthouse a11y ≥ 90'],
          issues: ['Missing error states on forms'],
          readyForImplementation: false,
        },
        questions: [],
        risks: [],
      }),
    );

    expect(review).toMatchObject({
      kind: 'build_plan_qa',
      headline: 'QA checklist ready before implementation',
    });
    expect(review?.sections).toEqual(
      expect.arrayContaining([
        { label: 'Checklist', value: ['Mobile checkout', 'Empty cart state'] },
        { label: 'Acceptance criteria', value: ['Lighthouse a11y ≥ 90'] },
        { label: 'Issues', value: ['Missing error states on forms'] },
        { label: 'Ready for implementation', value: 'No' },
      ]),
    );
  });

  it('falls back to summary when no structured review fields exist', () => {
    const review = extractReviewContent(
      outreachArtifact({
        status: 'success',
        summary: 'Generic agent note',
        output: { note: 'nothing structured' },
        questions: [],
        risks: [],
      }),
    );

    expect(review).toEqual({
      kind: 'summary',
      headline: 'Generic agent note',
    });
  });

  it('formats raw content when artifact is not an agent result', () => {
    const review = extractReviewContent(outreachArtifact({ note: 'legacy blob' }));

    expect(review?.kind).toBe('fallback');
    expect(review?.headline).toContain('legacy blob');
  });

  it('returns null when artifact is missing', () => {
    expect(extractReviewContent(null)).toBeNull();
  });
});

describe('formatApprovalToast', () => {
  it('announces resumption when the workflow keeps running', () => {
    expect(formatApprovalToast(approvedRun({ status: 'running' }))).toBe(
      'Approved — workflow resuming',
    );
  });

  it('announces completion when the workflow finishes after approval', () => {
    expect(formatApprovalToast(approvedRun({ status: 'completed' }))).toBe(
      'Approved — workflow completed',
    );
  });
});

describe('formatRejectionToast', () => {
  it('includes the rejection reason when present', () => {
    expect(
      formatRejectionToast(
        approvedRun({ status: 'rejected', error: 'Needs a warmer opener' }),
      ),
    ).toBe('Rejected — Needs a warmer opener');
  });

  it('falls back when no reason is stored', () => {
    expect(formatRejectionToast(approvedRun({ status: 'rejected', error: null }))).toBe(
      'Rejected at approval gate',
    );
  });
});
