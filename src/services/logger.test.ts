import { describe, expect, it } from "vitest";
import { MemoryLogger } from "./logger.js";

describe("MemoryLogger", () => {
  it("records entries with level, message and meta", () => {
    const logger = new MemoryLogger();
    logger.info("started", { step: "s1" });
    logger.error("boom");
    expect(logger.entries).toHaveLength(2);
    expect(logger.entries[0]).toMatchObject({
      level: "info",
      message: "started",
      meta: { step: "s1" },
    });
    expect(logger.entries[1]).toMatchObject({ level: "error", message: "boom" });
    expect(logger.entries[1]?.meta).toBeUndefined();
  });
});
