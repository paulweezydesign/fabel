const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AuthConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly password: string;
      readonly secret: string;
      readonly maxAgeSeconds: number;
    };

/**
 * Single-tenant gate for the V1 prototype (PRD §10 Q6).
 * Auth is off unless FABEL_AUTH_PASSWORD is set, so CI/local smoke stays open.
 */
export const resolveAuthConfig = (
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig => {
  const password = env.FABEL_AUTH_PASSWORD?.trim();
  if (!password) {
    return { enabled: false };
  }

  const secret = env.FABEL_AUTH_SECRET?.trim() || password;
  const parsedMaxAge = Number(env.FABEL_AUTH_MAX_AGE_SECONDS);
  const maxAgeSeconds =
    Number.isFinite(parsedMaxAge) && parsedMaxAge > 0
      ? Math.floor(parsedMaxAge)
      : DEFAULT_MAX_AGE_SECONDS;

  return {
    enabled: true,
    password,
    secret,
    maxAgeSeconds,
  };
};
