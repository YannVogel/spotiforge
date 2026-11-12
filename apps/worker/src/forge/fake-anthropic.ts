// Tests seulement : réponses simulées de l'API Messages d'Anthropic, au niveau HTTP.
import { makeForgeResponse } from '@spotiforge/shared/testing';
import { vi } from 'vitest';

export type Reply = Response | Error;

export function messageReply(text: string, stopReason = 'end_turn'): Response {
  return Response.json({
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [
      { type: 'thinking', thinking: '', signature: 'fake-signature' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1200, output_tokens: 900 },
  });
}

export const validReply = () => messageReply(JSON.stringify(makeForgeResponse()));

export function errorReply(status: number, type = 'api_error'): Response {
  return Response.json({ type: 'error', error: { type, message: 'fake error' } }, { status });
}

/** Un `fetch` qui renvoie les réponses dans l'ordre et garde les requêtes reçues. */
export function fakeAnthropic(...replies: Reply[]) {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      url: request.url,
      headers: request.headers,
      body: (await request.json()) as Record<string, unknown>,
    });
    const reply = replies.shift();
    if (!reply) throw new Error('No more fake replies');
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, requests };
}
