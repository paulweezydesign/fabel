import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { resolveAuthBaseURL, resolveTrustedOrigins } from "./auth-config";
import { getDb, getMongoClient } from "./db";

const useMemoryFallback = !process.env.MONGODB_URI;

async function createAuth() {
  const db = await getDb();
  const client = await getMongoClient();
  const authEnv = {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  };
  const baseURL = resolveAuthBaseURL(authEnv);

  return betterAuth({
    database: mongodbAdapter(db, {
      client,
      // Memory / standalone Mongo cannot run multi-doc transactions.
      transaction: useMemoryFallback ? false : undefined,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
    },
    // Dynamic host so Vite can hop ports (5173 → 5174) without Invalid origin.
    baseURL: {
      allowedHosts: ["localhost:*", "127.0.0.1:*"],
      protocol: "http",
      fallback: baseURL,
    },
    trustedOrigins: resolveTrustedOrigins(authEnv),
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "dev-only-change-me-rr7-rsc-rag-32chars!",
  });
}

const authPromise = createAuth();

export const auth = await authPromise;

export type AuthSession = typeof auth.$Infer.Session;
