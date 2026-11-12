import { z } from 'zod';

import type { Account } from '../../domain/session';

const ME_URL = 'https://api.spotify.com/v1/me';

// `GET /me` ne renvoie plus email, pays ni abonnement (docs/SPOTIFY_API.md) : schéma tolérant.
const meSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().nullish(),
});

export type AccountResult =
  | { ok: true; account: Account }
  | { ok: false; reason: 'unauthorized' | 'forbidden' | 'unavailable' };

/** Identité du compte connecté (`GET /me`, endpoint confirmé). */
export async function fetchSpotifyAccount(
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<AccountResult> {
  let response: Response;
  try {
    response = await fetchFn(ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (response.status === 401) return { ok: false, reason: 'unauthorized' };
  // Compte absent des 5 utilisateurs autorisés de l'app en mode développement.
  if (response.status === 403) return { ok: false, reason: 'forbidden' };
  if (!response.ok) return { ok: false, reason: 'unavailable' };

  const me = meSchema.safeParse(await response.json().catch(() => null));
  if (!me.success) return { ok: false, reason: 'unavailable' };
  return { ok: true, account: { id: me.data.id, displayName: me.data.display_name ?? null } };
}
