/**
 * Canned structured payloads for AI_PROVIDER=stub so local demos populate
 * approval gates with realistic review content (no network).
 */
export const buildDemoStubReply = (userPrompt: string): string => {
  const task = userPrompt.match(/Task:\s*(.+)/)?.[1]?.trim() ?? '';
  const lower = `${task}\n${userPrompt}`.toLowerCase();

  if (lower.includes('outreach') || lower.includes('personalised outreach')) {
    return JSON.stringify({
      summary: 'Drafted a personalised outreach plan for review.',
      message:
        'Hi there — I noticed your upcoming launch and thought a focused storefront refresh could help conversion before Q3.',
      subject: 'Quick idea ahead of your launch',
      channel: 'email',
      outreachPlan: 'Warm intro email, then a LinkedIn follow-up after three days.',
      touchpoints: 2,
      nextSteps: ['Send intro email', 'Follow up on LinkedIn after 3 days'],
      toneNotes: 'Warm, specific, and grounded in the prospect’s stated goal.',
      questions: [],
      risks: ['Contact details may need verification'],
    });
  }

  if (lower.includes('project brief') || lower.includes('compose the project brief')) {
    return JSON.stringify({
      summary: 'Composed a project brief ready for operator approval.',
      briefTitle: 'Client project brief',
      brief:
        'Deliver a focused build that matches the stated goals, with clear milestones and known blockers called out before kickoff.',
      goals: ['Clarify scope', 'Ship a reviewable first milestone'],
      scope: ['Discovery synthesis', 'Core delivery plan'],
      outOfScope: ['Unrelated platform migrations'],
      milestones: [
        {
          title: 'Kickoff',
          description: 'Align on goals and success metrics',
          tasks: ['Confirm stakeholders', 'Lock timeline'],
        },
      ],
      successMetrics: ['Approved brief', 'Clear next milestone'],
      blockers: ['Missing brand assets'],
      marketContextSummary: 'Synthesized from prior research when available.',
      questions: [],
      risks: ['Scope may expand without a firm out-of-scope list'],
    });
  }

  if (lower.includes('qa checklist') || lower.includes('create the qa checklist')) {
    return JSON.stringify({
      summary: 'Prepared a QA checklist before implementation begins.',
      acceptanceCriteria: ['Primary user flows are testable', 'Accessibility basics covered'],
      checklist: ['Mobile layout', 'Empty and error states', 'Keyboard navigation'],
      issues: ['Acceptance criteria need product owner confirmation'],
      blockers: [],
      readyForImplementation: false,
      questions: ['Who signs off on acceptance criteria?'],
      risks: ['Starting build before checklist sign-off'],
    });
  }

  if (lower.includes('research') || lower.includes('market') || lower.includes('prospect')) {
    return JSON.stringify({
      summary: 'Captured market and prospect context for downstream agents.',
      facts: ['Client is preparing a near-term launch', 'Primary channel appears to be web'],
      sources: ['Workflow input', 'Prior public positioning'],
      marketContext: 'Competitive market; clarity and speed matter more than broad feature sprawl.',
      questions: [],
      risks: ['Limited public data'],
    });
  }

  if (lower.includes('visual') || lower.includes('design')) {
    return JSON.stringify({
      summary: 'Proposed a visual direction for the build.',
      direction: 'Clean, high-contrast product UI with strong hierarchy',
      palette: ['#0f1117', '#e8eaef', '#6c8cff'],
      typography: 'Expressive display + readable body',
      layoutNotes: 'Full-bleed hero, sparse first viewport, one primary CTA',
      questions: [],
      risks: [],
    });
  }

  if (lower.includes('build plan') || lower.includes('tech')) {
    return JSON.stringify({
      summary: 'Outlined a pragmatic build plan.',
      stack: ['Next.js', 'TypeScript'],
      architecture: 'App Router API routes with injected AI client',
      buildPlan: ['Scaffold routes', 'Wire agents', 'Ship approval gate'],
      fileStructure: ['src/agents', 'src/workflows', 'app/api'],
      questions: [],
      risks: [],
    });
  }

  if (lower.includes('goals') || lower.includes('summarise client')) {
    return JSON.stringify({
      summary: 'Summarised client goals from intake.',
      goals: ['Launch on schedule', 'Improve conversion'],
      milestones: [],
      blockers: ['Success metrics not yet quantified'],
      questions: [],
      risks: [],
    });
  }

  return JSON.stringify({
    summary: 'Stubbed agent work completed.',
    detail: 'Canned output for local development.',
    questions: [],
    risks: [],
  });
};
