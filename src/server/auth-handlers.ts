import {
  resolveAuthConfig,
  type AuthConfig,
} from '@/auth/auth-config';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/auth/cookies';
import { createSessionToken } from '@/auth/session';

export { SESSION_COOKIE_NAME };

type LoginDeps = {
  readonly resolveConfig?: () => AuthConfig;
  readonly now?: () => number;
};

const json = (status: number, body: unknown, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });

const readPassword = async (request: Request): Promise<string | null> => {
  try {
    const body = (await request.json()) as { password?: unknown };
    return typeof body.password === 'string' ? body.password : null;
  } catch {
    return null;
  }
};

export const createLoginHandler = (deps: LoginDeps = {}) => {
  const resolveConfig = deps.resolveConfig ?? (() => resolveAuthConfig());
  const now = deps.now ?? (() => Date.now());

  return async (request: Request): Promise<Response> => {
    const config = resolveConfig();
    if (!config.enabled) {
      return json(400, { error: 'Authentication is disabled on this server.' });
    }

    const password = await readPassword(request);
    if (password === null) {
      return json(400, { error: 'Password is required.' });
    }

    if (password !== config.password) {
      return json(401, { error: 'Invalid password.' });
    }

    const token = await createSessionToken({
      secret: config.secret,
      maxAgeSeconds: config.maxAgeSeconds,
      now: now(),
    });

    return json(
      200,
      { ok: true },
      { 'set-cookie': buildSessionCookie(token, config.maxAgeSeconds) },
    );
  };
};

export const createLogoutHandler =
  () =>
  async (_request?: Request): Promise<Response> =>
    json(
      200,
      { ok: true },
      { 'set-cookie': buildClearedSessionCookie() },
    );
