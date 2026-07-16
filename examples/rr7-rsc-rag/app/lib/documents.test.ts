import { describe, expect, it } from "vitest";
import { listRecentDocuments, type DocumentRecord } from "./documents";

describe("listRecentDocuments", () => {
  it("returns documents owned by the user, newest first", async () => {
    const docs: DocumentRecord[] = [
      {
        id: "1",
        ownerId: "user_1",
        title: "Older brief",
        summary: "A",
        updatedAt: new Date("2026-01-01").toISOString(),
      },
      {
        id: "2",
        ownerId: "user_1",
        title: "Newer brief",
        summary: "B",
        updatedAt: new Date("2026-06-01").toISOString(),
      },
      {
        id: "3",
        ownerId: "user_2",
        title: "Someone else",
        summary: "C",
        updatedAt: new Date("2026-07-01").toISOString(),
      },
    ];

    const result = await listRecentDocuments("user_1", {
      findByOwner: async (ownerId) => docs.filter((d) => d.ownerId === ownerId),
    });

    expect(result.map((d) => d.id)).toEqual(["2", "1"]);
  });

  it("returns an empty list when the user has no documents", async () => {
    const result = await listRecentDocuments("user_1", {
      findByOwner: async () => [],
    });
    expect(result).toEqual([]);
  });
});
