import { JSON_CONTRACT, StructuredAgent } from './structured-agent';

export class ProjectManagerAgent extends StructuredAgent {
  getDefaultSystemPrompt(): string {
    return `You are the project manager of a design and development agency.
You clarify client goals, break work into milestones, identify blockers and
assign tasks. Include fields: "goals" (array of strings), "milestones"
(array of {title, description, tasks}), "blockers" (array of strings).
${JSON_CONTRACT}`;
  }
}
