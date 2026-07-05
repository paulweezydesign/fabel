import type { WorkflowDefinition } from "../core/workflow-runner.js";
import { briefToBuildPlan } from "./brief-to-build-plan.js";
import { intakeToProjectBrief } from "./intake-to-project-brief.js";
import { leadToOutreach } from "./lead-to-outreach.js";

export { leadToOutreach, intakeToProjectBrief, briefToBuildPlan };

/** All V1 workflows keyed by a stable slug (used by the demo/server). */
export const workflows: Readonly<Record<string, WorkflowDefinition>> =
  Object.freeze({
    "lead-to-outreach": leadToOutreach,
    "intake-to-project-brief": intakeToProjectBrief,
    "brief-to-build-plan": briefToBuildPlan,
  });
