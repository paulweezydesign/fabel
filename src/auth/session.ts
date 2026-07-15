export type SessionVerifyResult =
  | { readonly ok: true; readonly expiresAt: number }
  | { readonly ok: false; readonly reason: 'invalid' | 'expired' };

const encoder = new TextEncoder();

const toBase64Url = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string): Uint8Array | null => {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLength));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
};

const importHmacKey = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

const signPayload = async (secret: string, payload: string): Promise<string> => {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(signature);
};

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
};

export const createSessionToken = async (options: {
  readonly secret: string;
  readonly maxAgeSeconds: number;
  readonly now?: number;
}): Promise<string> => {
  const now = options.now ?? Date.now();
  const expiresAt = now + options.maxAgeSeconds * 1000;
  const payload = `v1.${expiresAt}`;
  const signature = await signPayload(options.secret, payload);
  return `${payload}.${signature}`;
};

export const verifySessionToken = async (
  token: string,
  options: { readonly secret: string; readonly now?: number },
): Promise<SessionVerifyResult> => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return { ok: false, reason: 'invalid' };
  }

  const expiresAt = Number(parts[1]);
  const signature = parts[2];
  if (!Number.isFinite(expiresAt) || !signature) {
    return { ok: false, reason: 'invalid' };
  }

  const payload = `v1.${expiresAt}`;
  const expected = await signPayload(options.secret, payload);
  const actualBytes = fromBase64Url(signature);
  const expectedBytes = fromBase64Url(expected);
  if (!actualBytes || !expectedBytes || !timingSafeEqual(actualBytes, expectedBytes)) {
    return { ok: false, reason: 'invalid' };
  }

  const now = options.now ?? Date.now();
  if (now >= expiresAt) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, expiresAt };
};
