import { describe, expect, it } from 'vitest';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readCookieValue,
  SESSION_COOKIE_NAME,
} from './cookies';

describe('cookies', () => {
  it('reads a named cookie from a header', () => {
    expect(
      readCookieValue('a=1; fabel_session=token%2Evalue; b=2', SESSION_COOKIE_NAME),
    ).toBe('token.value');
  });

  it('returns null when the cookie is missing', () => {
    expect(readCookieValue('a=1', SESSION_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(null, SESSION_COOKIE_NAME)).toBeNull();
  });

  it('builds an HttpOnly session cookie', () => {
    const header = buildSessionCookie('tok.en', 120);
    expect(header).toContain(`${SESSION_COOKIE_NAME}=tok.en`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Max-Age=120');
    expect(header).toContain('Path=/');
  });

  it('builds a cleared session cookie', () => {
    const header = buildClearedSessionCookie();
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain('Max-Age=0');
  });
});
