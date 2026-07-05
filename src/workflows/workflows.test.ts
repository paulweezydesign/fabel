import { describe, expect, it } from "vitest";
import { AgentFactory } from "../core/agent-factory.js";
import { AgentType } from "../core/agent-types.js";
import { WorkflowRunner } from "../core/workflow-runner.js";
import { makeTestServices } from "../testing/test-services.js";
import type { OutreachOutput } from "../agents/client-growth-agent.js";
import { briefToBuildPlan } from "./brief-to-build-plan.js";
import { intakeToProjectBrief } from "./intake-to-project-brief.js";
import { leadToOutreach } from "./lead-to-outreach.js";

const setup = () => {
  const services = makeTestServices({
    // Canned, structured-ish AI output so the run is deterministic (§9).
    responder: (req) => `Response for: ${req.prompt}\n- point one\n- point two`,
  });
  return {
    services,
    runner: new WorkflowRunner(
      new AgentFactory(services),
      services.artifactStore,
    ),
  };
};

describe("V1 workflows end-to-end with a stubbed AiClient (AC-16)", () => {
  it("Lead → Outreach: produces the artifact sequence, pauses, then completes", async () => {
    const { runner, services } = setup();
    const started = await runner.start(leadToOutreach, {
      projectId: "proj-lead",
      workflowInput: { prospect: "Acme Corp" },
    });

    expect(started.status).toBe("needs_review");
    expect(started.pausedStepId).toBe("outreach");
    const beforeApproval = await services.artifactStore.getByWorkflowId(
      started.workflowId,
    );
    expect(beforeApproval.map((a) => a.title)).toEqual([
      "Research prospect",
      "Draft outreach plan",
    ]);
    // The outreach step consumed the research artifact end-to-end.
    const outreach = beforeApproval[1]?.content as OutreachOutput;
    expect(outreach.basedOnResearch).toBe(true);

    const completed = await runner.approve(started.workflowId, "outreach");
    expect(completed.status).toBe("completed");
    expect(completed.finishedAt).toBeTypeOf("string");
  });

  it("Intake → Project Brief: three steps, pauses at the brief gate, completes", async () => {
    const { runner, services } = setup();
    const started = await runner.start(intakeToProjectBrief);
    expect(started.status).toBe("needs_review");
    expect(started.pausedStepId).toBe("brief");
    const artifacts = await services.artifactStore.getByWorkflowId(
      started.workflowId,
    );
    expect(artifacts.map((a) => a.title)).toEqual([
      "Summarize client goals",
      "Add market context",
      "Compose project brief",
    ]);
    expect(artifacts.map((a) => a.agentType)).toEqual([
      AgentType.ProjectManager,
      AgentType.Research,
      AgentType.ProjectManager,
    ]);

    const completed = await runner.approve(started.workflowId, "brief");
    expect(completed.status).toBe("completed");
  });

  it("Brief → Build Plan: design/tech/QA sequence, final gate, then completes", async () => {
    const { runner, services } = setup();
    const started = await runner.start(briefToBuildPlan);
    expect(started.status).toBe("needs_review");
    expect(started.pausedStepId).toBe("qa");
    const artifacts = await services.artifactStore.getByWorkflowId(
      started.workflowId,
    );
    expect(artifacts.map((a) => a.agentType)).toEqual([
      AgentType.Designer,
      AgentType.TechLead,
      AgentType.Qa,
    ]);

    const completed = await runner.approve(started.workflowId, "qa");
    expect(completed.status).toBe("completed");
  });

  it("each workflow's final step is the approval gate", () => {
    for (const def of [leadToOutreach, intakeToProjectBrief, briefToBuildPlan]) {
      const last = def.steps[def.steps.length - 1];
      expect(last?.requiresApproval).toBe(true);
    }
  });
});
