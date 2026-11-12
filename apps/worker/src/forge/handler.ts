import { forgeRequestSchema } from '@spotiforge/shared';

import type { SlotVerdict } from '../limit/sliding-window';
import type { ForgeGenerator } from './generate';
import { planForge } from './plan';

export type ForgeDependencies = {
  generate: ForgeGenerator;
  /** Réserve une forge dans la limite du compte (voir `limit/forge-limiter.ts`). */
  takeSlot: () => Promise<SlotVerdict>;
};

/**
 * `POST /forge` : valide la `ForgeRequest`, réserve une forge dans la limite du compte, demande
 * les candidats au modèle, renvoie une `ForgeResponse` conforme. Seules les requêtes valides
 * comptent dans la limite : ce sont elles qui coûtent un appel au modèle. Ni le prompt ni la
 * réponse ne sont stockés ou journalisés.
 */
export async function handleForge(
  request: Request,
  { generate, takeSlot }: ForgeDependencies,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = forgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Seuls les chemins des champs fautifs sont renvoyés, jamais leur contenu.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    return Response.json({ error: 'invalid_request', fields }, { status: 400 });
  }

  let slot: SlotVerdict;
  try {
    slot = await takeSlot();
  } catch (error) {
    // Sans compteur, pas d'appel au modèle : la limite protège la facture. Les messages d'erreur
    // du runtime ne contiennent ni la requête ni le compte.
    console.error(
      `Forge limiter unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return Response.json({ error: 'limiter_unavailable' }, { status: 503 });
  }
  if (!slot.allowed) {
    return Response.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(slot.retryAfterSeconds) } },
    );
  }

  const result = await generate(parsed.data, planForge(parsed.data));
  if (!result.ok) {
    return Response.json({ error: 'forge_failed', reason: result.reason }, { status: 502 });
  }
  return Response.json(result.response);
}
