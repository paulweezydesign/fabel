import { describe, expect, it } from "vitest";
import { makeTestServices, type TestServices } from "../testing/test-services.js";
import { AgentFactory } from "./agent-factory.js";
import { AgentType } from "./agent-types.js";
import {
  WorkflowRunner,
  WorkflowValidationError,
  type WorkflowDefinition,
} from "./workflow-runner.js";

const setup = (
  aiOptions?: Parameters<typeof makeTestServices>[0],
): { runner: WorkflowRunner; services: TestServices } => {
  const services = makeTestServices(aiOptions);
  const runner = new WorkflowRunner(
    new AgentFactory(services),
    services.artifactStore,
  );
  return { runner, services };
};

describe("WorkflowRunner dependency ordering (AC-7)", () => {
  it("runs a dependent step only after its dependency completes, regardless of definition order", async () => {
    const { runner, services } = setup({ defaultText: "ok" });
    const def: WorkflowDefinition = {
      name: "deps",
      steps: [
        { id: "b", title: "B", agentType: AgentType.Qa, dependsOn: ["a"] },
        { id: "a", title: "A", agentType: AgentType.Research },
      ],
    };
    const run = await runner.start(def);
    expect(run.status).toBe("completed");
    const artifacts = await services.artifactStore.getByWorkflowId(
      run.workflowId,
    );
    expect(artifacts.map((x) => x.title)).toEqual(["A", "B"]);
  });
});

describe("WorkflowRunner approval gates (AC-8, AC-9)", () => {
  const gated: WorkflowDefinition = {
    name: "gated",
    steps: [
      { id: "a", title: "A", agentType: AgentType.Research },
      {
        id: "b",
        title: "B",
        agentType: AgentType.ClientGrowth,
        dependsOn: ["a"],
        requiresApproval: true,
      },
      { id: "c", title: "C", agentType: AgentType.Qa, dependsOn: ["b"] },
    ],
  };

  it("pauses at the gate and runs no subsequent step (AC-8)", async () => {
    const { runner, services } = setup({ defaultText: "ok" });
    const run = await runner.start(gated);
    expect(run.status).toBe("needs_review");
    expect(run.pausedStepId).toBe("b");
    expect(run.steps.find((s) => s.step.id === "c")?.status).toBe("pending");
    const titles = (
      await services.artifactStore.getByWorkflowId(run.workflowId)
    ).map((x) => x.title);
    expect(titles).toEqual(["A", "B"]);
  });

  it("resumes from the successor after approval, not the beginning (AC-9)", async () => {
    const { runner, services } = setup({ defaultText: "ok" });
    const started = await runner.start(gated);
    const resumed = await runner.approve(started.workflowId, "b");
    expect(resumed.status).toBe("completed");
    const titles = (
      await services.artifactStore.getByWorkflowId(resumed.workflowId)
    ).map((x) => x.title);
    expect(titles).toEqual(["A", "B", "C"]);
    // "A" ran exactly once (not re-run on resume).
    expect(titles.filter((t) => t === "A")).toHaveLength(1);
  });

  it("rejects approval when the workflow is not awaiting review", async () => {
    const { runner } = setup({ defaultText: "ok" });
    const run = await runner.start({
      name: "single",
      steps: [{ id: "a", title: "A", agentType: AgentType.Research }],
    });
    await expect(runner.approve(run.workflowId, "a")).rejects.toThrow(
      /not awaiting approval/,
    );
  });
});

describe("WorkflowRunner fail-stop (AC-10, FR-11)", () => {
  it("halts on step failure, marks the step failed, and keeps prior artifacts", async () => {
    const { runner, services } = setup({
      responder: (req) => {
        if (req.systemPrompt.includes("QA")) throw new Error("qa exploded");
        return "ok";
      },
    });
    const def: WorkflowDefinition = {
      name: "failing",
      steps: [
        { id: "a", title: "A", agentType: AgentType.Research },
        { id: "b", title: "B", agentType: AgentType.Qa, dependsOn: ["a"] },
        { id: "c", title: "C", agentType: AgentType.Designer, dependsOn: ["b"] },
      ],
    };
    const run = await runner.start(def);
    expect(run.status).toBe("failed");
    expect(run.steps.find((s) => s.step.id === "b")?.status).toBe("failed");
    expect(run.steps.find((s) => s.step.id === "c")?.status).toBe("pending");
    const artifacts = await services.artifactStore.getByWorkflowId(
      run.workflowId,
    );
    expect(artifacts.map((x) => x.title)).toEqual(["A"]);
  });
});

describe("WorkflowRunner persistence (AC-11)", () => {
  it("persists each completed step with correct workflowId, agentType and content", async () => {
    const { runner, services } = setup({ defaultText: "- one\n- two" });
    const run = await runner.start({
      name: "persist",
      steps: [{ id: "a", title: "Research", agentType: AgentType.Research }],
      projectId: undefined,
    } as WorkflowDefinition);
    const [artifact] = await services.artifactStore.getByWorkflowId(
      run.workflowId,
    );
    expect(artifact?.workflowId).toBe(run.workflowId);
    expect(artifact?.agentType).toBe(AgentType.Research);
    expect(artifact?.content).toMatchObject({ facts: ["one", "two"] });
  });
});

describe("WorkflowRunner validation (§8)", () => {
  it("refuses to run on a missing dependency", async () => {
    const { runner } = setup();
    await expect(
      runner.start({
        name: "bad",
        steps: [
          { id: "a", title: "A", agentType: AgentType.Research, dependsOn: ["ghost"] },
        ],
      }),
    ).rejects.toThrow(WorkflowValidationError);
  });

  it("refuses to run on a circular dependency, naming the steps", async () => {
    const { runner } = setup();
    await expect(
      runner.start({
        name: "cycle",
        steps: [
          { id: "a", title: "A", agentType: AgentType.Research, dependsOn: ["b"] },
          { id: "b", title: "B", agentType: AgentType.Qa, dependsOn: ["a"] },
        ],
      }),
    ).rejects.toThrow(/circular dependency/);
  });

  it("refuses to run on duplicate step ids", async () => {
    const { runner } = setup();
    await expect(
      runner.start({
        name: "dupe",
        steps: [
          { id: "a", title: "A", agentType: AgentType.Research },
          { id: "a", title: "A2", agentType: AgentType.Qa },
        ],
      }),
    ).rejects.toThrow(/duplicate step id/);
  });
});

describe("WorkflowRunner edge cases (§8)", () => {
  it("completes an empty workflow immediately with zero artifacts", async () => {
    const { runner, services } = setup();
    const run = await runner.start({ name: "empty", steps: [] });
    expect(run.status).toBe("completed");
    expect(
      await services.artifactStore.getByWorkflowId(run.workflowId),
    ).toEqual([]);
  });

  it("marks a step failed when its agent type is unregistered", async () => {
    const services = makeTestServices();
    const runner = new WorkflowRunner(
      new AgentFactory(services, new Map()),
      services.artifactStore,
    );
    const run = await runner.start({
      name: "unregistered",
      steps: [{ id: "a", title: "A", agentType: AgentType.Research }],
    });
    expect(run.status).toBe("failed");
    expect(run.steps[0]?.status).toBe("failed");
    expect(run.steps[0]?.error).toMatch(/No agent registered/);
  });
});
