import { forgeResponseSchema } from '@spotiforge/shared';
import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';
import { describe, expect, it, vi } from 'vitest';

import type { SlotVerdict } from '../limit/sliding-window';
import type { ForgeGenerator } from './generate';
import { handleForge } from './handler';
import { planForge } from './plan';

const post = (body: string) =>
  new Request('https://worker.example.test/forge', { method: 'POST', body });

function generator(result: Awaited<ReturnType<ForgeGenerator>>) {
  return vi.fn<ForgeGenerator>(async () => result);
}

const allowed = () => vi.fn(async (): Promise<SlotVerdict> => ({ allowed: true }));

describe('handleForge', () => {
  it('renvoie la ForgeResponse générée pour une requête valide', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    // Sans `locale` : le contrat applique la valeur par défaut.
    const withoutLocale = Object.fromEntries(
      Object.entries(makeForgeRequest()).filter(([key]) => key !== 'locale'),
    );

    const response = await handleForge(post(JSON.stringify(withoutLocale)), {
      generate,
      takeSlot: allowed(),
    });

    expect(response.status).toBe(200);
    expect(forgeResponseSchema.parse(await response.json())).toEqual(makeForgeResponse());
    // La requête validée, valeurs par défaut appliquées, et son plan.
    expect(generate).toHaveBeenCalledWith(makeForgeRequest(), planForge(makeForgeRequest()));
  });

  it('refuse un corps qui n’est pas du JSON', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    const takeSlot = allowed();

    const response = await handleForge(post('{oups'), { generate, takeSlot });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
    expect(generate).not.toHaveBeenCalled();
    expect(takeSlot).not.toHaveBeenCalled();
  });

  it('refuse une requête hors contrat en nommant les champs, sans leur contenu', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    const body = { ...makeForgeRequest(), discovery: 500, prompt: '   ' };
    const takeSlot = allowed();

    const response = await handleForge(post(JSON.stringify(body)), { generate, takeSlot });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      fields: ['discovery', 'prompt'],
    });
    expect(generate).not.toHaveBeenCalled();
    // Une requête hors contrat n'appelle pas le modèle : elle ne compte pas dans la limite.
    expect(takeSlot).not.toHaveBeenCalled();
  });

  it('répond 429 avec Retry-After au-delà de la limite, sans appeler le modèle', async () => {
    const generate = generator({ ok: true, response: makeForgeResponse() });
    const takeSlot = vi.fn(async (): Promise<SlotVerdict> => ({
      allowed: false,
      retryAfterSeconds: 1234,
    }));

    const response = await handleForge(post(JSON.stringify(makeForgeRequest())), {
      generate,
      takeSlot,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('1234');
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('répond 503 sans appeler le modèle quand le compteur est injoignable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const generate = generator({ ok: true, response: makeForgeResponse() });
    const takeSlot = vi.fn(async (): Promise<SlotVerdict> => {
      throw new Error('Durable Object is overloaded');
    });

    const response = await handleForge(post(JSON.stringify(makeForgeRequest())), {
      generate,
      takeSlot,
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'limiter_unavailable' });
    expect(generate).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Forge limiter unavailable: Durable Object is overloaded',
    );
    consoleError.mockRestore();
  });

  it.each(['invalid_output', 'refused', 'upstream'] as const)(
    'répond 502 quand la génération échoue (%s)',
    async (reason) => {
      const response = await handleForge(post(JSON.stringify(makeForgeRequest())), {
        generate: generator({ ok: false, reason }),
        takeSlot: allowed(),
      });

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'forge_failed', reason });
    },
  );
});
