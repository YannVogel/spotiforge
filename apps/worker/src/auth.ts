import { z } from 'zod';

import { sha256Hex } from './fingerprint';

const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me';
/** Durée pendant laquelle une identité vérifiée est réutilisée sans rappeler Spotify. */
export const IDENTITY_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_IDENTITIES = 100;

// `GET /me` ne renvoie plus email, pays ni abonnement (docs/SPOTIFY_API.md) : seul `id` compte.
const spotifyMeSchema = z.object({ id: z.string().min(1) });

export type AuthResult =
  | { ok: true; accountId: string }
  | {
      ok: false;
      status: 401 | 403 | 502;
      error: 'unauthorized' | 'forbidden' | 'spotify_unavailable';
    };

/** Identités vérifiées, indexées par l'empreinte SHA-256 du jeton (jamais par le jeton). */
export type IdentityCache = Map<string, { accountId: string; expiresAt: number }>;

type Dependencies = {
  fetch: typeof fetch;
  now: () => number;
  cache: IdentityCache;
};

const UNAUTHORIZED: AuthResult = { ok: false, status: 401, error: 'unauthorized' };
const FORBIDDEN: AuthResult = { ok: false, status: 403, error: 'forbidden' };
const UNAVAILABLE: AuthResult = { ok: false, status: 502, error: 'spotify_unavailable' };

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? null;
}

function remember(cache: IdentityCache, key: string, accountId: string, now: number) {
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  if (cache.size >= MAX_CACHED_IDENTITIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { accountId, expiresAt: now + IDENTITY_TTL_MS });
}

/**
 * Vérifie qu'une requête vient d'un compte Spotify autorisé : jeton lu dans `Authorization`,
 * identité demandée à Spotify (`GET /me`), comparée à la liste autorisée. Rien de ce qui est
 * journalisé ne contient de jeton ni d'identifiant.
 */
export function createAuthenticator({ fetch, now, cache }: Dependencies) {
  async function identify(token: string): Promise<AuthResult> {
    const key = await sha256Hex(token);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return { ok: true, accountId: cached.accountId };

    let response: Response;
    try {
      response = await fetch(SPOTIFY_ME_URL, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      console.error('Spotify identity check failed: network error');
      return UNAVAILABLE;
    }
    if (response.status === 401) return UNAUTHORIZED;
    // Spotify répond 403 à un compte absent des 5 utilisateurs du mode développement.
    if (response.status === 403) return FORBIDDEN;
    if (!response.ok) {
      console.error(`Spotify identity check failed with status ${response.status}`);
      return UNAVAILABLE;
    }

    const me = spotifyMeSchema.safeParse(await response.json().catch(() => null));
    if (!me.success) {
      console.error('Spotify identity check returned an unexpected body');
      return UNAVAILABLE;
    }
    remember(cache, key, me.data.id, now());
    return { ok: true, accountId: me.data.id };
  }

  return async function authenticate(
    request: Request,
    allowedAccountIds: ReadonlySet<string>,
  ): Promise<AuthResult> {
    const token = bearerToken(request);
    if (!token) return UNAUTHORIZED;
    const identity = await identify(token);
    if (!identity.ok) return identity;
    // La liste autorisée est relue à chaque requête : un retrait prend effet tout de suite.
    return allowedAccountIds.has(identity.accountId) ? identity : FORBIDDEN;
  };
}
