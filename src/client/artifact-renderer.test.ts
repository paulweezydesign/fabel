import { describe, expect, it } from 'vitest';
import {
  extractHighlights,
  extractSummary,
  formatArtifactForDisplay,
} from './artifact-renderer';

const researchArtifact = {
  status: 'success',
  summary: 'Researched Acme Corp — footwear retailer with strong DTC presence.',
  output: {
    facts: ['Sells shoes online and in 12 retail locations', 'Founded 2018'],
    sources: ['acme.com/about', 'TechCrunch profile'],
    marketContext: 'Competitive DTC footwear market; Acme differentiates on sustainability.',
  },
  questions: ['Do they have an existing design system?'],
  risks: ['Limited public financial data'],
};

const clientGrowthArtifact = {
  status: 'success',
  summary: 'Drafted a two-touch outreach plan for Acme Corp.',
  output: {
    outreachPlan: 'Email intro followed by a LinkedIn connection request.',
    message:
      'Hi Jordan — I noticed Acme\'s sustainability push and thought our team could help refresh your product pages before Q3.',
    touchpoints: 2,
    nextSteps: ['Send intro email', 'Follow up on LinkedIn after 3 days'],
  },
  questions: [],
  risks: ['Contact email unverified'],
};

const plainJsonArtifact = {
  customField: 'hello',
  nested: { value: 42 },
};

describe('extractSummary', () => {
  it('returns the summary from an AgentRunResult-shaped artifact', () => {
    expect(extractSummary(researchArtifact)).toBe(
      'Researched Acme Corp — footwear retailer with strong DTC presence.',
    );
  });

  it('returns plain strings as-is', () => {
    expect(extractSummary('Legacy text artifact')).toBe('Legacy text artifact');
  });

  it('falls back when no summary field is present', () => {
    expect(extractSummary(plainJsonArtifact)).toBe('Artifact output');
  });
});

describe('extractHighlights', () => {
  it('extracts research facts, sources, and market context', () => {
    const highlights = extractHighlights(researchArtifact);

    expect(highlights).toEqual([
      { label: 'Facts', value: researchArtifact.output.facts },
      { label: 'Sources', value: researchArtifact.output.sources },
      { label: 'Market context', value: researchArtifact.output.marketContext },
      { label: 'Questions', value: researchArtifact.questions },
      { label: 'Risks', value: researchArtifact.risks },
    ]);
  });

  it('extracts client growth message, plan, and next steps', () => {
    const highlights = extractHighlights(clientGrowthArtifact);

    expect(highlights).toEqual([
      { label: 'Outreach message', value: clientGrowthArtifact.output.message },
      { label: 'Outreach plan', value: clientGrowthArtifact.output.outreachPlan },
      { label: 'Touchpoints', value: '2' },
      { label: 'Next steps', value: clientGrowthArtifact.output.nextSteps },
      { label: 'Risks', value: clientGrowthArtifact.risks },
    ]);
  });

  it('falls back to top-level keys for non-AgentRunResult content', () => {
    const highlights = extractHighlights(plainJsonArtifact);

    expect(highlights).toEqual([{ label: 'Custom Field', value: 'hello' }]);
  });
});

describe('formatArtifactForDisplay', () => {
  it('returns summary, highlights, and pretty-printed raw JSON', () => {
    const formatted = formatArtifactForDisplay(researchArtifact);

    expect(formatted.summary).toBe(researchArtifact.summary);
    expect(formatted.highlights.some((h) => h.label === 'Facts')).toBe(true);
    expect(formatted.raw).toContain('"facts"');
    expect(formatted.raw).toContain('Sells shoes');
  });

  it('handles plain strings without highlights', () => {
    const formatted = formatArtifactForDisplay('plain text');

    expect(formatted).toEqual({
      summary: 'plain text',
      highlights: [],
      raw: 'plain text',
    });
  });
});
