import { describe, expect, it } from 'vitest';
import {
  createLoginHandler,
  createLogoutHandler,
  SESSION_COOKIE_NAME,
} from './auth-handlers';
import { verifySessionToken } from '@/auth/session';
import type { AuthConfig } from '@/auth/auth-config';

const enabledConfig = (): AuthConfig => ({
  enabled: true,
  password: 'correct-horse',
  secret: 'signing-secret',
  maxAgeSeconds: 3600,
});

const parseSetCookie = (header: string | null): Record<string, string> => {
  if (!header) return {};
  const [pair, ...attrs] = header.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq);
  const value = pair.slice(eq + 1);
  const result: Record<string, string> = { [name]: value };
  for (const attr of attrs) {
    const [k, v] = attr.split('=');
    result[k.toLowerCase()] = v ?? 'true';
  }
  return result;
};

describe('auth handlers', () => {
  it('rejects login when auth is disabled', async () => {
    const login = createLoginHandler({
      resolveConfig: () => ({ enabled: false }),
    });

    const response = await login(
      new Request('http://test/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'anything' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/disabled/i),
    });
  });

  it('rejects an incorrect password', async () => {
    const login = createLoginHandler({
      resolveConfig: enabledConfig,
    });

    const response = await login(
      new Request('http://test/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('sets a signed session cookie on successful login', async () => {
    const config = enabledConfig();
    expect(config.enabled).toBe(true);
    const login = createLoginHandler({
      resolveConfig: () => config,
      now: () => 1_700_000_000_000,
    });

    const response = await login(
      new Request('http://test/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'correct-horse' }),
      }),
    );

    expect(response.status).toBe(200);
    const cookies = parseSetCookie(response.headers.get('set-cookie'));
    expect(cookies[SESSION_COOKIE_NAME]).toBeTruthy();
    expect(cookies.httponly?.toLowerCase() || cookies.HttpOnly).toBeTruthy();
    expect(cookies.path).toBe('/');

    if (!config.enabled) {
      throw new Error('expected enabled auth config');
    }

    const verified = await verifySessionToken(cookies[SESSION_COOKIE_NAME], {
      secret: config.secret,
      now: 1_700_000_000_000,
    });
    expect(verified.ok).toBe(true);
  });

  it('clears the session cookie on logout', async () => {
    const logout = createLogoutHandler();

    const response = await logout(
      new Request('http://test/api/auth/logout', { method: 'POST' }),
    );

    expect(response.status).toBe(200);
    const cookies = parseSetCookie(response.headers.get('set-cookie'));
    expect(cookies[SESSION_COOKIE_NAME]).toBe('');
    expect(cookies['max-age']).toBe('0');
  });
});
