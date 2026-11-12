import { forgeResponseSchema } from '@spotiforge/shared';
import { makeCandidate, makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply, fakeAnthropic, messageReply, type Reply, validReply } from './fake-anthropic';
import { createForgeGenerator } from './generate';
import { planForge } from './plan';

const SECRET_PROMPT = 'Un minerai très personnel qui ne doit jamais apparaître dans les logs';
const request = makeForgeRequest({ prompt: SECRET_PROMPT });
const plan = planForge(request);

let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  logs = (['error', 'warn', 'log', 'info'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
});

afterEach(() => {
  // Ni le prompt ni la réponse du modèle ne sont journalisés.
  const written = JSON.stringify(logs.flatMap((spy) => spy.mock.calls));
  expect(written).not.toContain(SECRET_PROMPT);
  expect(written).not.toContain('Titre 1');
  vi.restoreAllMocks();
});

function generatorWith(...replies: Reply[]) {
  const anthropic = fakeAnthropic(...replies);
  const generate = createForgeGenerator({
    apiKey: 'fake-anthropic-key',
    model: 'claude-opus-5-5',
    maxRetries: 0,
    fetch: anthropic.fetch,
  });
  return { generate, anthropic };
}

describe('createForgeGenerator', () => {
  it('renvoie une ForgeResponse conforme au contrat', async () => {
    const { generate, anthropic } = generatorWith(validReply());

    const result = await generate(request, plan);

    expect(result).toEqual({ ok: true, response: makeForgeResponse() });
    expect(anthropic.requests).toHaveLength(1);
  });

  it('demande le modèle configuré, une sortie JSON structurée et le repli serveur', async () => {
    const { generate, anthropic } = generatorWith(validReply());

    await generate(request, plan);

    const [sent] = anthropic.requests;
    expect(sent?.url).toContain('/v1/messages');
    expect(sent?.headers.get('authorization')).toContain('fake-anthropic-key');
    expect(sent?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(sent?.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16_000,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      system: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
    });
    expect(sent?.body).not.toHaveProperty('temperature');
    expect(sent?.body).not.toHaveProperty('tool_choice');
  });

  it('envoie le minerai comme une donnée, dans la requête balisée', async () => {
    const { generate, anthropic } = generatorWith(validReply());

    await generate(request, plan);

    const messages = anthropic.requests[0]?.body.messages as { role: string; content: string }[];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toMatch(/^<forge_request>\n.*\n<\/forge_request>$/s);
    expect(messages[0]?.content).toContain(`"candidate_count":${plan.candidateCount}`);
  });

  it.each([
    ['un texte qui n’est pas du JSON', messageReply('Voici votre playlist !')],
    ['un JSON hors contrat', messageReply(JSON.stringify(makeForgeResponse({ candidates: [] })))],
    [
      'un candidat hors bornes',
      messageReply(JSON.stringify(makeForgeResponse({ candidates: [makeCandidate({ slot: 3 })] }))),
    ],
    ['une sortie tronquée', messageReply('{"title": "Route de', 'max_tokens')],
  ])('retente une fois après %s, et réussit', async (_case, invalid) => {
    const { generate, anthropic } = generatorWith(invalid, validReply());

    const result = await generate(request, plan);

    expect(result.ok).toBe(true);
    expect(anthropic.requests).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Claude output invalid (attempt 1/2)');
  });

  it('échoue proprement après deux sorties invalides, sans troisième essai', async () => {
    const { generate, anthropic } = generatorWith(
      messageReply('nope'),
      messageReply('{"still": "nope"}'),
      validReply(),
    );

    expect(await generate(request, plan)).toEqual({ ok: false, reason: 'invalid_output' });
    expect(anthropic.requests).toHaveLength(2);
  });

  it('ne retente pas un refus', async () => {
    const { generate, anthropic } = generatorWith(messageReply('', 'refusal'), validReply());

    expect(await generate(request, plan)).toEqual({ ok: false, reason: 'refused' });
    expect(anthropic.requests).toHaveLength(1);
  });

  it.each([
    ['une erreur serveur', errorReply(500)],
    ['une surcharge', errorReply(529, 'overloaded_error')],
    ['une limite de débit', errorReply(429, 'rate_limit_error')],
    ['une clé refusée', errorReply(401, 'authentication_error')],
    ['une coupure réseau', new TypeError('fetch failed')],
  ])('signale une erreur amont après %s', async (_case, reply) => {
    const { generate } = generatorWith(reply);

    expect(await generate(request, plan)).toEqual({ ok: false, reason: 'upstream' });
  });

  it('ne produit jamais de réponse hors contrat', async () => {
    const replies = [
      messageReply(JSON.stringify({ ...makeForgeResponse(), title: '' })),
      messageReply(JSON.stringify({ ...makeForgeResponse(), extra: 'champ en trop' })),
    ];
    const { generate } = generatorWith(...replies);

    const result = await generate(request, plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(forgeResponseSchema.parse(result.response)).toEqual(result.response);
      expect(result.response).not.toHaveProperty('extra');
    }
  });
});
