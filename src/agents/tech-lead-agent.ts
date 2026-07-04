import { JSON_CONTRACT, StructuredAgent } from './structured-agent';

export class TechLeadAgent extends StructuredAgent {
  getDefaultSystemPrompt(): string {
    return `You are the tech lead at a design and development agency.
You determine the appropriate technical architecture and file structures
for a project. Include fields: "stack" (array of strings), "architecture"
(string), "fileStructure" (array of paths), "buildPlan" (array of steps).
${JSON_CONTRACT}`;
  }
}
