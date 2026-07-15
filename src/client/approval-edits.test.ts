import { describe, expect, it } from 'vitest';
import type { Artifact } from '@/core/artifact-store';
import { AgentType } from '@/core/agent-types';
import {
  applyApprovalEdits,
  draftToEdits,
  extractEditableDraft,
  hasApprovalEdits,
} from './approval-edits';

const artifact = (content: unknown): Artifact => ({
  id: 'art-1',
  workflowId: 'run-1',
  projectId: 'proj-1',
  agentType: AgentType.ClientGrowth,
  title: 'Draft a personalised outreach plan',
  content,
  createdAt: '2026-07-15T00:00:00.000Z',
  sequence: 0,
});

describe('applyApprovalEdits', () => {
  it('overwrites outreach message and subject on a structured artifact', () => {
    const next = applyApprovalEdits(
      {
        status: 'success',
        summary: 'Drafted outreach',
        output: { message: 'Hi Acme', subject: 'Old subject', touchpoints: 2 },
        questions: [],
        risks: [],
      },
      { message: '  Hello Acme — revised  ', subject: 'New subject' },
    );

    expect(next.output).toMatchObject({
      message: 'Hello Acme — revised',
      subject: 'New subject',
      touchpoints: 2,
    });
    expect(next.summary).toBe('Drafted outreach');
  });

  it('rewrites brief fields and summary', () => {
    const next = applyApprovalEdits(
      {
        status: 'success',
        summary: 'Brief ready',
        output: { briefTitle: 'Old', brief: 'Old body', goals: ['A'] },
        questions: [],
        risks: [],
      },
      {
        briefTitle: 'Acme Q3',
        brief: 'Revised narrative',
        summary: 'Operator-edited brief',
      },
    );

    expect(next).toMatchObject({
      summary: 'Operator-edited brief',
      output: {
        briefTitle: 'Acme Q3',
        brief: 'Revised narrative',
        goals: ['A'],
      },
    });
  });

  it('parses checklistText into a checklist array', () => {
    const next = applyApprovalEdits(
      {
        status: 'success',
        summary: 'QA',
        output: { checklist: ['Old'], readyForImplementation: false },
        questions: [],
        risks: [],
      },
      { checklistText: 'Mobile checkout\n\nEmpty cart\n' },
    );

    expect(next.output).toMatchObject({
      checklist: ['Mobile checkout', 'Empty cart'],
      readyForImplementation: false,
    });
  });

  it('rejects non-structured artifact content', () => {
    expect(() => applyApprovalEdits({ note: 'raw' }, { message: 'x' })).toThrow(
      /structured agent/i,
    );
  });
});

describe('extractEditableDraft', () => {
  it('loads editable fields from a gated outreach artifact', () => {
    const draft = extractEditableDraft(
      artifact({
        status: 'success',
        summary: 'Drafted',
        output: {
          message: 'Hi',
          subject: 'Subject',
          checklist: ['a', 'b'],
        },
        questions: [],
        risks: [],
      }),
    );

    expect(draft).toEqual({
      message: 'Hi',
      subject: 'Subject',
      briefTitle: '',
      brief: '',
      summary: 'Drafted',
      checklistText: 'a\nb',
    });
  });

  it('returns empty strings when artifact is missing', () => {
    expect(extractEditableDraft(null).message).toBe('');
  });
});

describe('draftToEdits / hasApprovalEdits', () => {
  it('only includes outreach fields for outreach gates', () => {
    const edits = draftToEdits(
      {
        message: 'Hi',
        subject: 'Sub',
        briefTitle: 'should ignore',
        brief: 'should ignore',
        summary: 's',
        checklistText: 'one',
      },
      'outreach_message',
    );
    expect(hasApprovalEdits(edits)).toBe(true);
    expect(edits).toEqual({ message: 'Hi', subject: 'Sub', summary: 's' });
  });

  it('only includes brief fields for project brief gates', () => {
    const edits = draftToEdits(
      {
        message: 'ignore',
        subject: '',
        briefTitle: 'Title',
        brief: 'Body',
        summary: 's',
        checklistText: '',
      },
      'project_brief',
    );
    expect(edits).toEqual({ briefTitle: 'Title', brief: 'Body', summary: 's' });
  });
});
