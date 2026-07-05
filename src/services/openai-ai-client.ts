/**
 * Real {@link AiClient} adapter for OpenAI-compatible Chat Completions APIs
 * (FR-4, FR-15; resolves the open provider question in PRD §10 #1).
 *
 * Uses the built-in global `fetch` (no SDK dependency). Config comes from
 * constructor options with `process.env` fallbacks, so the same class works in
 * tests (inject `fetchImpl` + `env`) and in production (real env + `fetch`).
 */
import {
  StubAiClient,
  type AiClient,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type StubResponder,
} from "./ai-client.js";

/** Subset of the global `fetch` signature we depend on (injectable for tests). */
export type FetchImpl = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiClientOptions {
  /** API key; falls back to `env.OPENAI_API_KEY`. Required (throws if absent). */
  readonly apiKey?: string;
  /** API base URL; falls back to `env.OPENAI_BASE_URL`, default OpenAI. */
  readonly baseUrl?: string;
  /** Model id; falls back to `env.OPENAI_MODEL`, default `gpt-4o-mini`. */
  readonly model?: string;
  /** Request timeout in ms (AbortController). Default 30_000. */
  readonly timeoutMs?: number;
  /** Injected `fetch` so tests never hit the network. Default global `fetch`. */
  readonly fetchImpl?: FetchImpl;
  /** Environment source for fallbacks. Default `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 30_000;

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null };
  }>;
}

export class OpenAiClient implements AiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchImpl;

  constructor(options: OpenAiClientOptions = {}) {
    const env = options.env ?? process.env;
    const apiKey = options.apiKey ?? env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAiClient requires an API key: pass `apiKey` or set OPENAI_API_KEY.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (
      options.baseUrl ??
      env.OPENAI_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.model = options.model ?? env.OPENAI_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async complete(
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.prompt },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OpenAiClient request failed with status ${response.status} ${response.statusText}: ${body}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
      throw new Error(
        "OpenAiClient response is missing choices[0].message.content.",
      );
    }
    return { text };
  }
}

/**
 * Default stub responder used when no provider key is present, preserving the
 * platform's original demo output so workflows still run end-to-end offline.
 */
const stubDraftResponder: StubResponder = ({ prompt }) =>
  `Draft based on: "${prompt}".\n- Key point one\n- Key point two\n- Key point three`;

/**
 * Pure selector: an {@link OpenAiClient} when `OPENAI_API_KEY` is set, else the
 * {@link StubAiClient}. Takes `env` explicitly so it is unit-testable without
 * mutating the real process environment.
 */
export const selectAiClient = (env: NodeJS.ProcessEnv): AiClient =>
  env.OPENAI_API_KEY
    ? new OpenAiClient({ env })
    : new StubAiClient({ responder: stubDraftResponder });
