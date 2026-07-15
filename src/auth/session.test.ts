import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
} from './session';

describe('session tokens', () => {
  const secret = 'test-signing-secret';

  it('creates a verifiable token that expires in the future', async () => {
    const now = 1_700_000_000_000;
    const token = await createSessionToken({
      secret,
      maxAgeSeconds: 3600,
      now,
    });

    const result = await verifySessionToken(token, { secret, now });
    expect(result).toEqual({ ok: true, expiresAt: now + 3600 * 1000 });
  });

  it('rejects a tampered token', async () => {
    const token = await createSessionToken({
      secret,
      maxAgeSeconds: 3600,
      now: Date.now(),
    });
    const tampered = `${token.slice(0, -2)}xx`;

    await expect(
      verifySessionToken(tampered, { secret, now: Date.now() }),
    ).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an expired token', async () => {
    const issuedAt = 1_700_000_000_000;
    const token = await createSessionToken({
      secret,
      maxAgeSeconds: 60,
      now: issuedAt,
    });

    await expect(
      verifySessionToken(token, {
        secret,
        now: issuedAt + 61_000,
      }),
    ).resolves.toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken({
      secret: 'a',
      maxAgeSeconds: 3600,
      now: Date.now(),
    });

    await expect(
      verifySessionToken(token, { secret: 'b', now: Date.now() }),
    ).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects malformed tokens', async () => {
    await expect(
      verifySessionToken('not-a-token', { secret, now: Date.now() }),
    ).resolves.toEqual({ ok: false, reason: 'invalid' });
  });
});
