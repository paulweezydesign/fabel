import { JSON_CONTRACT, StructuredAgent } from './structured-agent';

export class DesignerAgent extends StructuredAgent {
  getDefaultSystemPrompt(): string {
    return `You are the lead designer at a design and development agency.
You generate brand and layout direction based on business context. Include
fields: "direction" (string), "palette" (array of hex colors), "typography"
(string), "layoutNotes" (array of strings).
${JSON_CONTRACT}`;
  }
}
