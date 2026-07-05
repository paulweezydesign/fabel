import { describe, expect, it } from "vitest";
import { createAgentContext } from "../core/agent-context.js";
import type { AgentServices } from "../core/agent-services.js";
import type { AgentTaskInput } from "../core/agent-task.js";
import { AgentType } from "../core/agent-types.js";
import type { Artifact } from "../core/artifact-store.js";
import type { BaseAgent } from "../core/base-agent.js";
import { makeTestServices } from "../testing/test-services.js";
import { ClientGrowthAgent, type OutreachOutput } from "./client-growth-agent.js";
import { DesignerAgent, type DesignDirectionOutput } from "./designer-agent.js";
import {
  FullStackEngineerAgent,
  type CodeArtifactOutput,
} from "./full-stack-engineer-agent.js";
import {
  ProjectManagerAgent,
  type ProjectPlanOutput,
} from "./project-manager-agent.js";
import { QaAgent, type QaChecklistOutput } from "./qa-agent.js";
import { ResearchAgent, type ResearchOutput } from "./research-agent.js";
import { TechLeadAgent, type BuildPlanOutput } from "./tech-lead-agent.js";

const build = <T extends BaseAgent>(
  Ctor: new (p: {
    id: string;
    type: AgentType;
    context: ReturnType<typeof createAgentContext>;
    services: AgentServices;
  }) => T,
  type: AgentType,
  services: AgentServices,
): T =>
  new Ctor({ id: `${type}-1`, type, context: createAgentContext(), services });

const taskInput = (
  prompt: string,
  priorArtifacts: readonly Artifact[] = [],
): AgentTaskInput => ({ prompt, priorArtifacts });

describe("ResearchAgent (§6.6)", () => {
  it("returns a summary and facts parsed from the AI response", async () => {
    const services = makeTestServices({ defaultText: "- fact one\n- fact two" });
    const agent = build(ResearchAgent, AgentType.Research, services);
    const result = await agent.assignTask(taskInput("Acme Corp"));
    const output = result.output as ResearchOutput;
    expect(result.status).toBe("success");
    expect(output.facts).toEqual(["fact one", "fact two"]);
    expect(services.aiClient.calls[0]?.prompt).toBe("Acme Corp");
  });

  it("raises a question when no facts are produced", async () => {
    const services = makeTestServices({ defaultText: "   " });
    const agent = build(ResearchAgent, AgentType.Research, services);
    const result = await agent.assignTask(taskInput("Unknown"));
    expect(result.questions.length).toBeGreaterThan(0);
  });
});

describe("ClientGrowthAgent (§6.6)", () => {
  it("incorporates prior research and lists channels", async () => {
    const services = makeTestServices({ defaultText: "Hi there!" });
    const research: Artifact = {
      id: "a1",
      workflowId: "wf",
      agentType: AgentType.Research,
      title: "Research",
      content: { subject: "Acme", summary: "Acme sells widgets", facts: [] },
    };
    const agent = build(ClientGrowthAgent, AgentType.ClientGrowth, services);
    const result = await agent.assignTask(
      taskInput("Draft outreach", [research]),
    );
    const output = result.output as OutreachOutput;
    expect(output.basedOnResearch).toBe(true);
    expect(output.channels).toContain("email");
    expect(services.aiClient.calls[0]?.prompt).toContain("Acme sells widgets");
  });
});

describe("ProjectManagerAgent (§6.6)", () => {
  it("produces a brief and milestone list", async () => {
    const services = makeTestServices({ defaultText: "1. discovery\n2. build" });
    const agent = build(ProjectManagerAgent, AgentType.ProjectManager, services);
    const result = await agent.assignTask(taskInput("Plan the project"));
    const output = result.output as ProjectPlanOutput;
    expect(output.milestones).toEqual(["discovery", "build"]);
    expect(output.brief).toContain("discovery");
  });
});

describe("DesignerAgent (§6.6)", () => {
  it("returns a direction and palette", async () => {
    const services = makeTestServices({ defaultText: "Bold and minimal" });
    const agent = build(DesignerAgent, AgentType.Designer, services);
    const result = await agent.assignTask(taskInput("Design a brand"));
    const output = result.output as DesignDirectionOutput;
    expect(output.direction).toBe("Bold and minimal");
    expect(output.palette.length).toBeGreaterThan(0);
  });
});

describe("TechLeadAgent (§6.6)", () => {
  it("returns architecture and a file list", async () => {
    const services = makeTestServices({ defaultText: "- src/app.ts\n- src/db.ts" });
    const agent = build(TechLeadAgent, AgentType.TechLead, services);
    const result = await agent.assignTask(taskInput("Plan the build"));
    const output = result.output as BuildPlanOutput;
    expect(output.files).toEqual(["src/app.ts", "src/db.ts"]);
  });
});

describe("FullStackEngineerAgent (§6.6, §10 #5)", () => {
  it("returns code as artifact content", async () => {
    const services = makeTestServices({ defaultText: "export const x = 1;" });
    const agent = build(
      FullStackEngineerAgent,
      AgentType.FullStackEngineer,
      services,
    );
    const result = await agent.assignTask(taskInput("Implement x"));
    const output = result.output as CodeArtifactOutput;
    expect(output.code).toBe("export const x = 1;");
    expect(output.language).toBe("typescript");
  });
});

describe("QaAgent (§6.6)", () => {
  it("returns acceptance criteria and a checklist", async () => {
    const services = makeTestServices({ defaultText: "- renders\n- submits" });
    const agent = build(QaAgent, AgentType.Qa, services);
    const result = await agent.assignTask(taskInput("QA the build"));
    const output = result.output as QaChecklistOutput;
    expect(output.checklist).toEqual(["renders", "submits"]);
    expect(output.acceptanceCriteria).toEqual(["renders", "submits"]);
  });
});
