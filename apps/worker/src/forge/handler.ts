import { forgeRequestSchema } from '@spotiforge/shared';

import type { ForgeGenerator } from './generate';
import { planForge } from './plan';

/**
 * `POST /forge` : valide la `ForgeRequest`, demande les candidats au modèle, renvoie une
 * `ForgeResponse` conforme. Rien n'est stocké, ni le prompt ni la réponse journalisés.
 */
export async function handleForge(request: Request, generate: ForgeGenerator): Promise<Response> {
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

  const result = await generate(parsed.data, planForge(parsed.data));
  if (!result.ok) {
    return Response.json({ error: 'forge_failed', reason: result.reason }, { status: 502 });
  }
  return Response.json(result.response);
}
