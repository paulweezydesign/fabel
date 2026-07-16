import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDb, getMongoClient } from "./db";

const useMemoryFallback = !process.env.MONGODB_URI;

async function createAuth() {
  const db = await getDb();
  const client = await getMongoClient();

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
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:5173"],
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-change-me-rr7-rsc-rag",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  });
}

const authPromise = createAuth();

export const auth = await authPromise;

export type AuthSession = typeof auth.$Infer.Session;
