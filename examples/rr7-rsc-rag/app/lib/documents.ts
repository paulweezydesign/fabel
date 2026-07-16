export type DocumentRecord = {
  id: string;
  ownerId: string;
  title: string;
  summary: string;
  updatedAt: string;
};

export type DocumentsDeps = {
  findByOwner: (ownerId: string) => Promise<DocumentRecord[]>;
};

type DocumentDoc = {
  _id: { toString(): string };
  ownerId: string;
  title: string;
  summary: string;
  updatedAt: Date | string;
};

const defaultFindByOwner = async (ownerId: string): Promise<DocumentRecord[]> => {
  const { getDb } = await import("./db");
  const db = await getDb();
  const rows = (await db
    .collection("documents")
    .find({ ownerId })
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray()) as unknown as DocumentDoc[];

  return rows.map((row) => ({
    id: String(row._id),
    ownerId: row.ownerId,
    title: row.title,
    summary: row.summary,
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : row.updatedAt.toISOString(),
  }));
};

export async function listRecentDocuments(
  ownerId: string,
  deps: DocumentsDeps = { findByOwner: defaultFindByOwner },
): Promise<DocumentRecord[]> {
  const docs = await deps.findByOwner(ownerId);
  return [...docs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Seed demo docs for a user when the collection is empty (sandbox DX). */
export async function ensureDemoDocuments(ownerId: string): Promise<void> {
  const { getDb } = await import("./db");
  const db = await getDb();
  const collection = db.collection("documents");
  const count = await collection.countDocuments({ ownerId });
  if (count > 0) return;

  const now = Date.now();
  await collection.insertMany([
    {
      ownerId,
      title: "Q3 agency capabilities brief",
      summary: "Service pillars, case studies, and positioning notes.",
      updatedAt: new Date(now - 1000 * 60 * 60 * 24),
    },
    {
      ownerId,
      title: "Client onboarding checklist",
      summary: "Kickoff questions, access list, and success metrics.",
      updatedAt: new Date(now - 1000 * 60 * 30),
    },
  ]);
}
