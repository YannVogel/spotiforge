import { forgeResponseSchema } from '@spotiforge/shared';
import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';
import { describe, expect, it, vi } from 'vitest';

import type { ForgeGenerator } from './generate';
import { handleForge } from './handler';
import { planForge } from './plan';

const post = (body: string) =>
  new Request('https://worker.example.test/forge', { method: 'POST', body });

function generator(result: Awaited<ReturnType<ForgeGenerator>>) {
  return vi.fn<ForgeGenerator>(async () => result);
}

describe('handleForge', () => {
  it('renvoie la ForgeResponse générée pour une requête valide', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    // Sans `locale` : le contrat applique la valeur par défaut.
    const withoutLocale = Object.fromEntries(
      Object.entries(makeForgeRequest()).filter(([key]) => key !== 'locale'),
    );

    const response = await handleForge(post(JSON.stringify(withoutLocale)), generate);

    expect(response.status).toBe(200);
    expect(forgeResponseSchema.parse(await response.json())).toEqual(makeForgeResponse());
    // La requête validée, valeurs par défaut appliquées, et son plan.
    expect(generate).toHaveBeenCalledWith(makeForgeRequest(), planForge(makeForgeRequest()));
  });

  it('refuse un corps qui n’est pas du JSON', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });

    const response = await handleForge(post('{oups'), generate);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuse une requête hors contrat en nommant les champs, sans leur contenu', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    const body = { ...makeForgeRequest(), discovery: 500, prompt: '   ' };

    const response = await handleForge(post(JSON.stringify(body)), generate);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      fields: ['discovery', 'prompt'],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(['invalid_output', 'refused', 'upstream'] as const)(
    'répond 502 quand la génération échoue (%s)',
    async (reason) => {
      const response = await handleForge(
        post(JSON.stringify(makeForgeRequest())),
        generator({ ok: false, reason }),
      );

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'forge_failed', reason });
    },
  );
});
