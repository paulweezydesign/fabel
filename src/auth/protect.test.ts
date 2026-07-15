import { describe, expect, it } from 'vitest';
import {
  isPublicPath,
  resolveAuthGate,
} from './protect';

describe('isPublicPath', () => {
  it('allows login page and auth API routes', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/api/auth/login')).toBe(true);
    expect(isPublicPath('/api/auth/logout')).toBe(true);
  });

  it('protects the dashboard and workflow APIs', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/api/workflows/runs')).toBe(false);
    expect(isPublicPath('/api/agents/research/run')).toBe(false);
  });
});

describe('resolveAuthGate', () => {
  it('allows everything when auth is disabled', () => {
    expect(
      resolveAuthGate({
        authEnabled: false,
        pathname: '/api/workflows/runs',
        hasValidSession: false,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('allows public paths without a session', () => {
    expect(
      resolveAuthGate({
        authEnabled: true,
        pathname: '/login',
        hasValidSession: false,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('redirects HTML navigations to login when unauthenticated', () => {
    expect(
      resolveAuthGate({
        authEnabled: true,
        pathname: '/',
        hasValidSession: false,
        isApi: false,
      }),
    ).toEqual({ action: 'redirect', location: '/login?next=%2F' });
  });

  it('returns 401 for API requests when unauthenticated', () => {
    expect(
      resolveAuthGate({
        authEnabled: true,
        pathname: '/api/workflows/runs',
        hasValidSession: false,
        isApi: true,
      }),
    ).toEqual({ action: 'unauthorized' });
  });

  it('allows authenticated requests to protected paths', () => {
    expect(
      resolveAuthGate({
        authEnabled: true,
        pathname: '/',
        hasValidSession: true,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('sends authenticated users away from the login page', () => {
    expect(
      resolveAuthGate({
        authEnabled: true,
        pathname: '/login',
        hasValidSession: true,
      }),
    ).toEqual({ action: 'redirect', location: '/' });
  });
});
