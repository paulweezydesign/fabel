import "server-only";
import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | undefined;
let memoryUri: string | undefined;

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  // Local/demo fallback so the sandbox runs without Atlas.
  if (!memoryUri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const memory = await MongoMemoryServer.create();
    memoryUri = memory.getUri();
    console.info("[rr7-rsc-rag] Using in-memory MongoDB (set MONGODB_URI for Atlas)");
  }
  return memoryUri;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = resolveUri().then((uri) => new MongoClient(uri).connect());
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB_NAME ?? "rr7_rsc_rag");
}
