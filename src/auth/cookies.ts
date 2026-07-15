export const SESSION_COOKIE_NAME = 'fabel_session';

export const readCookieValue = (
  cookieHeader: string | null,
  name: string,
): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
};

export const buildSessionCookie = (
  token: string,
  maxAgeSeconds: number,
): string => {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') {
    attrs.push('Secure');
  }
  return attrs.join('; ');
};

export const buildClearedSessionCookie = (): string =>
  [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
