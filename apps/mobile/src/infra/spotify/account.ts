import type { Account } from '../../domain/session';
import { SPOTIFY_API_URL } from './http';
import { meSchema, toAccount } from './schemas';

const ME_URL = `${SPOTIFY_API_URL}/me`;

export type AccountResult =
  | { ok: true; account: Account }
  | { ok: false; reason: 'unauthorized' | 'forbidden' | 'unavailable' };

/**
 * Identité du compte, avant que la session existe (à la connexion). Ensuite, passer par le
 * client : `createSpotifyGateway(...).getCurrentAccount()`.
 */
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
  return { ok: true, account: toAccount(me.data) };
}
