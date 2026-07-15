import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from './next-path';

describe('sanitizeNextPath', () => {
  it('allows relative in-app paths', () => {
    expect(sanitizeNextPath('/')).toBe('/');
    expect(sanitizeNextPath('/runs')).toBe('/runs');
  });

  it('rejects absolute or protocol-relative URLs', () => {
    expect(sanitizeNextPath('https://evil.example')).toBe('/');
    expect(sanitizeNextPath('//evil.example')).toBe('/');
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('falls back for empty or missing values', () => {
    expect(sanitizeNextPath(null)).toBe('/');
    expect(sanitizeNextPath('')).toBe('/');
    expect(sanitizeNextPath('relative')).toBe('/');
  });
});
