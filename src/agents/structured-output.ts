/**
 * Models sometimes wrap JSON in code fences or prose. Extract the first
 * JSON object from a completion, failing loudly when there is none so the
 * runner records a proper step failure.
 */
export const extractJsonObject = (text: string): Record<string, unknown> => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    const looksLikeArray = text.trimStart().startsWith('[');
    throw new Error(
      looksLikeArray
        ? 'Model reply was a JSON array; a JSON object was expected.'
        : 'Model reply contained no JSON object.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('Model reply contained malformed JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Model reply JSON was not an object.');
  }
  return parsed as Record<string, unknown>;
};
