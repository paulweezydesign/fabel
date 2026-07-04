import { describe, expect, it } from 'vitest';
import {
  failureResult,
  isAgentRunResult,
  successResult,
} from './agent-result';

describe('AgentRunResult', () => {
  describe('successResult', () => {
    it('builds a success result with structured output (FR-3)', () => {
      const result = successResult({
        summary: 'Researched the prospect',
        output: { facts: ['fact one'] },
      });

      expect(result).toEqual({
        status: 'success',
        summary: 'Researched the prospect',
        output: { facts: ['fact one'] },
        questions: [],
        risks: [],
      });
    });

    it('carries questions and risks when provided', () => {
      const result = successResult({
        summary: 'done',
        output: {},
        questions: ['What is the budget?'],
        risks: ['Timeline is tight'],
      });

      expect(result.questions).toEqual(['What is the budget?']);
      expect(result.risks).toEqual(['Timeline is tight']);
    });
  });

  describe('failureResult', () => {
    it('builds a failure result carrying the error message', () => {
      const result = failureResult('AI provider timed out');

      expect(result).toEqual({
        status: 'failure',
        summary: 'AI provider timed out',
        output: null,
        questions: [],
        risks: [],
      });
    });
  });

  describe('isAgentRunResult', () => {
    it('accepts well-formed results', () => {
      expect(
        isAgentRunResult(successResult({ summary: 's', output: {} })),
      ).toBe(true);
      expect(isAgentRunResult(failureResult('boom'))).toBe(true);
    });

    it.each([
      null,
      undefined,
      'text blob',
      {},
      { status: 'success' },
      { status: 'weird', summary: 's', output: {}, questions: [], risks: [] },
      { status: 'success', summary: 42, output: {}, questions: [], risks: [] },
      { status: 'success', summary: 's', output: {}, questions: 'q', risks: [] },
      { status: 'success', summary: 's', output: {}, questions: [], risks: [1] },
    ])('rejects malformed value %#', (value) => {
      expect(isAgentRunResult(value)).toBe(false);
    });
  });
});
