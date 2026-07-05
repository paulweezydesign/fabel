import { AgentType } from "../core/agent-types.js";
import type { WorkflowDefinition } from "../core/workflow-runner.js";

/**
 * FR-17 — Lead → Outreach.
 * Research summarizes the prospect → Client Growth drafts outreach →
 * approval gate (outreach must reflect the agency's tone before sending).
 */
export const leadToOutreach: WorkflowDefinition = {
  name: "Lead → Outreach",
  steps: [
    {
      id: "research",
      title: "Research prospect",
      agentType: AgentType.Research,
      prompt: "Summarize the prospect's business and list key facts.",
    },
    {
      id: "outreach",
      title: "Draft outreach plan",
      agentType: AgentType.ClientGrowth,
      dependsOn: ["research"],
      requiresApproval: true,
      prompt:
        "Draft a personalized, on-brand outreach message for the prospect.",
    },
  ],
};
