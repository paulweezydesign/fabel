import { isAgentRunResult } from '@/core/agent-result';

export interface ArtifactHighlight {
  readonly label: string;
  readonly value: string | readonly string[];
}

export interface FormattedArtifact {
  readonly summary: string;
  readonly highlights: readonly ArtifactHighlight[];
  readonly raw: string;
}

const DEFAULT_SUMMARY = 'Artifact output';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');

const pushHighlight = (
  highlights: ArtifactHighlight[],
  label: string,
  value: unknown,
): void => {
  if (isNonEmptyString(value)) {
    highlights.push({ label, value });
    return;
  }
  if (isStringArray(value)) {
    highlights.push({ label, value });
  }
};

const pushNumericHighlight = (
  highlights: ArtifactHighlight[],
  label: string,
  value: unknown,
): void => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    highlights.push({ label, value: String(value) });
  }
};

const titleCaseLabel = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const extractOutputHighlights = (output: Record<string, unknown>): ArtifactHighlight[] => {
  const highlights: ArtifactHighlight[] = [];

  pushHighlight(highlights, 'Outreach message', output.message);
  pushHighlight(highlights, 'Subject', output.subject);
  pushHighlight(highlights, 'Channel', output.channel);
  pushHighlight(highlights, 'Outreach plan', output.outreachPlan);
  pushNumericHighlight(highlights, 'Touchpoints', output.touchpoints);
  pushHighlight(highlights, 'Next steps', output.nextSteps);
  pushHighlight(highlights, 'Tone notes', output.toneNotes);

  pushHighlight(highlights, 'Facts', output.facts);
  pushHighlight(highlights, 'Sources', output.sources);
  pushHighlight(highlights, 'Market context', output.marketContext);

  pushHighlight(highlights, 'Brief title', output.briefTitle);
  pushHighlight(highlights, 'Brief', output.brief);
  pushHighlight(highlights, 'Goals', output.goals);
  pushHighlight(highlights, 'Scope', output.scope);
  pushHighlight(highlights, 'Out of scope', output.outOfScope);
  pushHighlight(highlights, 'Success metrics', output.successMetrics);
  pushHighlight(highlights, 'Blockers', output.blockers);
  pushHighlight(highlights, 'Market context summary', output.marketContextSummary);

  pushHighlight(highlights, 'Direction', output.direction);
  pushHighlight(highlights, 'Palette', output.palette);
  pushHighlight(highlights, 'Typography', output.typography);
  pushHighlight(highlights, 'Layout notes', output.layoutNotes);

  pushHighlight(highlights, 'Stack', output.stack);
  pushHighlight(highlights, 'Architecture', output.architecture);
  pushHighlight(highlights, 'Build plan', output.buildPlan);
  pushHighlight(highlights, 'File structure', output.fileStructure);

  pushHighlight(highlights, 'Checklist', output.checklist);
  pushHighlight(highlights, 'Acceptance criteria', output.acceptanceCriteria);
  pushHighlight(highlights, 'Issues', output.issues);
  if (typeof output.readyForImplementation === 'boolean') {
    highlights.push({
      label: 'Ready for implementation',
      value: output.readyForImplementation ? 'Yes' : 'No',
    });
  }

  return highlights;
};

const extractFallbackHighlights = (content: Record<string, unknown>): ArtifactHighlight[] =>
  Object.entries(content)
    .filter(([, value]) => isNonEmptyString(value))
    .slice(0, 5)
    .map(([key, value]) => ({ label: titleCaseLabel(key), value: value as string }));

export const formatRawArtifactContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
};

export const extractSummary = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    const candidate = content as Record<string, unknown>;
    if (isNonEmptyString(candidate.summary)) return candidate.summary;
  }
  return DEFAULT_SUMMARY;
};

export const extractHighlights = (content: unknown): readonly ArtifactHighlight[] => {
  if (typeof content !== 'object' || content === null) return [];

  if (isAgentRunResult(content)) {
    const highlights = extractOutputHighlights(
      typeof content.output === 'object' && content.output !== null
        ? (content.output as Record<string, unknown>)
        : {},
    );

    pushHighlight(highlights, 'Questions', content.questions);
    pushHighlight(highlights, 'Risks', content.risks);

    return highlights;
  }

  return extractFallbackHighlights(content as Record<string, unknown>);
};

export const formatArtifactForDisplay = (content: unknown): FormattedArtifact => ({
  summary: extractSummary(content),
  highlights: extractHighlights(content),
  raw: formatRawArtifactContent(content),
});
