import { describe, expect, it } from "vitest";
import { AgentType } from "../core/agent-types.js";
import { InMemoryMessageBus } from "./message-bus.js";

describe("InMemoryMessageBus (§6.6, §10 #3)", () => {
  it("records published messages with a timestamp", () => {
    const bus = new InMemoryMessageBus();
    bus.publish({ from: AgentType.Research, type: "task.completed" });
    expect(bus.messages).toHaveLength(1);
    expect(bus.messages[0]).toMatchObject({
      from: AgentType.Research,
      type: "task.completed",
    });
    expect(bus.messages[0]?.at).toBeTypeOf("string");
  });
});
