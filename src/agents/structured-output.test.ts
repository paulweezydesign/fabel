import { describe, expect, it } from 'vitest';
import { extractJsonObject } from './structured-output';

describe('extractJsonObject', () => {
  it('parses a plain JSON object', () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a fenced code block', () => {
    expect(extractJsonObject('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON surrounded by prose', () => {
    expect(
      extractJsonObject('Here is the plan:\n{"a": 1}\nLet me know!'),
    ).toEqual({ a: 1 });
  });

  it('throws a descriptive error when there is no JSON object', () => {
    expect(() => extractJsonObject('just words')).toThrow(/JSON/);
  });

  it('throws when the JSON is not an object', () => {
    expect(() => extractJsonObject('[1, 2]')).toThrow(/object/i);
  });
});
