/**
 * Server-side AI access (FR-4, FR-15). Agents receive an `AiClient` via
 * injection and never construct clients or hold provider keys themselves.
 *
 * V1 leaves the concrete provider as an open question (PRD §10 #1); the
 * interface is intentionally minimal so a real provider adapter can implement
 * it later without touching agents.
 */
export interface AiCompletionRequest {
  readonly systemPrompt: string;
  readonly prompt: string;
}

export interface AiCompletionResponse {
  readonly text: string;
}

export interface AiClient {
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

export type StubResponder = (
  request: AiCompletionRequest,
) => string | Promise<string>;

export interface StubAiClientOptions {
  /** Custom responder; overrides `defaultText` when provided. */
  readonly responder?: StubResponder;
  /** Fixed text returned for every request when no responder is set. */
  readonly defaultText?: string;
}

/**
 * Test/V1 double for {@link AiClient}. Records every request (AC-4) and returns
 * canned output so unit and integration tests never touch the network (§9).
 */
export class StubAiClient implements AiClient {
  private readonly requests: AiCompletionRequest[] = [];

  constructor(private readonly options: StubAiClientOptions = {}) {}

  async complete(
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    this.requests.push(request);
    const text = this.options.responder
      ? await this.options.responder(request)
      : (this.options.defaultText ?? `stub:${request.prompt}`);
    return { text };
  }

  /** All requests captured so far, in call order. */
  get calls(): readonly AiCompletionRequest[] {
    return this.requests;
  }

  get callCount(): number {
    return this.requests.length;
  }
}
