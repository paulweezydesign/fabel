import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthConfig } from './auth-config';

describe('resolveAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables auth when FABEL_AUTH_PASSWORD is unset', () => {
    vi.stubEnv('FABEL_AUTH_PASSWORD', '');
    vi.stubEnv('FABEL_AUTH_SECRET', '');

    expect(resolveAuthConfig()).toEqual({ enabled: false });
  });

  it('enables auth when FABEL_AUTH_PASSWORD is set', () => {
    vi.stubEnv('FABEL_AUTH_PASSWORD', 's3cret');
    vi.stubEnv('FABEL_AUTH_SECRET', 'signing-key');

    expect(resolveAuthConfig()).toEqual({
      enabled: true,
      password: 's3cret',
      secret: 'signing-key',
      maxAgeSeconds: 60 * 60 * 24 * 7,
    });
  });

  it('falls back to the password as signing secret when FABEL_AUTH_SECRET is unset', () => {
    vi.stubEnv('FABEL_AUTH_PASSWORD', 's3cret');
    vi.stubEnv('FABEL_AUTH_SECRET', '');

    expect(resolveAuthConfig()).toMatchObject({
      enabled: true,
      password: 's3cret',
      secret: 's3cret',
    });
  });

  it('honours FABEL_AUTH_MAX_AGE_SECONDS', () => {
    vi.stubEnv('FABEL_AUTH_PASSWORD', 's3cret');
    vi.stubEnv('FABEL_AUTH_SECRET', 'signing-key');
    vi.stubEnv('FABEL_AUTH_MAX_AGE_SECONDS', '3600');

    expect(resolveAuthConfig()).toMatchObject({
      enabled: true,
      maxAgeSeconds: 3600,
    });
  });
});
