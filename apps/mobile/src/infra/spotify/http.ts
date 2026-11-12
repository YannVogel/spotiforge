import type { z } from 'zod';

import { SessionExpiredError, SessionUnavailableError } from '../../domain/session';
import { SpotifyError } from '../../domain/spotify';

/** Le seul endroit de l'app qui connaît l'adresse de l'API Spotify. */
export const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

/** Attente par défaut sur un 429 sans `Retry-After`. */
const DEFAULT_RETRY_AFTER_S = 1;
/** Au-delà, on n'attend pas : la forge échouerait de toute façon trop tard. */
export const MAX_RETRY_AFTER_S = 30;
export const MAX_RATE_LIMIT_RETRIES = 3;

type Session = {
  getAccessToken(): Promise<string>;
  refreshAfterUnauthorized(rejectedAccessToken: string): Promise<string>;
};

type Dependencies = {
  session: Session;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
};

function retryAfterSeconds(response: Response): number {
  const header = response.headers.get('Retry-After');
  const value = header === null || header.trim() === '' ? Number.NaN : Number(header);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RETRY_AFTER_S;
}

async function withSessionErrors<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof SessionExpiredError) throw new SpotifyError('unauthorized');
    if (error instanceof SessionUnavailableError) throw new SpotifyError('network');
    throw error;
  }
}

/**
 * Client HTTP de l'API Spotify : jeton d'accès, un seul rejeu après rafraîchissement sur 401,
 * attente de `Retry-After` sur 429, réponses validées par un schéma tolérant.
 */
export function createSpotifyHttp({ session, fetch, sleep }: Dependencies) {
  async function send(path: string, init: RequestInit, accessToken: string): Promise<Response> {
    try {
      return await fetch(`${SPOTIFY_API_URL}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new SpotifyError('network');
    }
  }

  return async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    init: RequestInit = {},
  ): Promise<z.output<S>> {
    let accessToken = await withSessionErrors(() => session.getAccessToken());
    let replayedAfterRefresh = false;
    let rateLimitRetries = 0;

    for (;;) {
      const response = await send(path, init, accessToken);

      if (response.status === 401 && !replayedAfterRefresh) {
        replayedAfterRefresh = true;
        const rejected = accessToken;
        accessToken = await withSessionErrors(() => session.refreshAfterUnauthorized(rejected));
        continue;
      }
      if (response.status === 429) {
        const wait = retryAfterSeconds(response);
        if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES || wait > MAX_RETRY_AFTER_S) {
          throw new SpotifyError('rate_limited', 429);
        }
        rateLimitRetries++;
        await sleep(wait * 1000);
        continue;
      }
      if (response.status === 401) throw new SpotifyError('unauthorized', 401);
      if (response.status === 403) throw new SpotifyError('forbidden', 403);
      if (!response.ok) throw new SpotifyError('unavailable', response.status);

      const body: unknown =
        response.status === 204 ? null : await response.json().catch(() => undefined);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        // Seul l'endpoint est journalisé (sans paramètres), jamais le contenu de la réponse.
        console.warn(`Unexpected Spotify response for ${path.split('?')[0]}`);
        throw new SpotifyError('unavailable', response.status);
      }
      return parsed.data;
    }
  };
}

export type SpotifyHttp = ReturnType<typeof createSpotifyHttp>;
