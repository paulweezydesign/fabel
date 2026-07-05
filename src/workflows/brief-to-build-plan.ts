import { AgentType } from "../core/agent-types.js";
import type { WorkflowDefinition } from "../core/workflow-runner.js";

/**
 * FR-19 — Brief → Build Plan.
 * Designer proposes visual direction → Tech Lead outlines a build plan → QA
 * creates a QA checklist → final approval gate before implementation.
 */
export const briefToBuildPlan: WorkflowDefinition = {
  name: "Brief → Build Plan",
  steps: [
    {
      id: "design",
      title: "Propose visual direction",
      agentType: AgentType.Designer,
      prompt: "Propose a visual direction from the project brief.",
    },
    {
      id: "techplan",
      title: "Outline build plan",
      agentType: AgentType.TechLead,
      dependsOn: ["design"],
      prompt: "Outline the technical architecture and files to build.",
    },
    {
      id: "qa",
      title: "Create QA checklist",
      agentType: AgentType.Qa,
      dependsOn: ["techplan"],
      requiresApproval: true,
      prompt: "Create acceptance criteria and a QA checklist for the build.",
    },
  ],
};
