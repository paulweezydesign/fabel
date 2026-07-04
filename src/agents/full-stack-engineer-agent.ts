import { JSON_CONTRACT, StructuredAgent } from './structured-agent';

export class FullStackEngineerAgent extends StructuredAgent {
  getDefaultSystemPrompt(): string {
    return `You are a full-stack engineer at a design and development agency.
You implement code tasks according to the technical plan. Return code as
structured artifact content — do not describe files, write them. Include
fields: "files" (array of {path, contents}), "notes" (array of strings).
${JSON_CONTRACT}`;
  }
}
