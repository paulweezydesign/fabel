import { AgentType } from "../core/agent-types.js";
import type { WorkflowDefinition } from "../core/workflow-runner.js";

/**
 * FR-18 — Intake → Project Brief.
 * PM summarizes client goals → Research adds market context → PM composes the
 * brief → approval gate.
 */
export const intakeToProjectBrief: WorkflowDefinition = {
  name: "Intake → Project Brief",
  steps: [
    {
      id: "goals",
      title: "Summarize client goals",
      agentType: AgentType.ProjectManager,
      prompt: "Summarize the client's goals and desired outcomes.",
    },
    {
      id: "market",
      title: "Add market context",
      agentType: AgentType.Research,
      dependsOn: ["goals"],
      prompt: "Research market context relevant to the client's goals.",
    },
    {
      id: "brief",
      title: "Compose project brief",
      agentType: AgentType.ProjectManager,
      dependsOn: ["market"],
      requiresApproval: true,
      prompt: "Compose a project brief with milestones from goals and market context.",
    },
  ],
};
