export type AuthEnv = {
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
};

const DEFAULT_BASE_URL = "http://localhost:5173";

export function resolveAuthBaseURL(env: AuthEnv = {}): string {
  return env.BETTER_AUTH_URL ?? DEFAULT_BASE_URL;
}

/**
 * Better Auth rejects requests whose Origin is not trusted.
 * Vite often hops to 5174+ when 5173 is busy, so trust loopback on any port.
 */
export function resolveTrustedOrigins(env: AuthEnv = {}): string[] {
  const baseURL = resolveAuthBaseURL(env);
  const extras = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [baseURL, "http://localhost:*", "http://127.0.0.1:*", ...extras];
}
