/**
 * AI access boundary. Agents never construct provider clients or hold API
 * keys — they receive an AiClient via injection (FR-4).
 */
export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface AiClient {
  complete(messages: readonly AiMessage[]): Promise<string>;
}
