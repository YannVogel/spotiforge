import { type ForgeRequest, forgeResponseSchema } from '@spotiforge/shared';

import { ForgeCancelledError, ForgeError, type ForgeGateway } from '../../domain/forge';
import {
  NotSignedInError,
  SessionExpiredError,
  SessionUnavailableError,
} from '../../domain/session';

type Session = {
  getAccessToken(): Promise<string>;
  refreshAfterUnauthorized(rejectedAccessToken: string): Promise<string>;
};

type Dependencies = {
  /** URL du Worker, sans barre finale (`AppConfig.workerUrl`). */
  workerUrl: string;
  session: Session;
  fetch: typeof fetch;
};

function retryAfterSeconds(response: Response): number | undefined {
  const value = Number(response.headers.get('Retry-After') ?? Number.NaN);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function withSessionErrors<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof SessionExpiredError || error instanceof NotSignedInError) {
      throw new ForgeError('unauthorized');
    }
    if (error instanceof SessionUnavailableError) throw new ForgeError('network');
    throw error;
  }
}

/**
 * Client du Worker de forge (`POST /forge`, docs/GENERATION.md) : jeton Spotify de la personne
 * dans `Authorization`, un seul rejeu après rafraîchissement sur 401, réponse revalidée par le
 * contrat partagé. Ni le minerai ni la réponse ne sont journalisés.
 */
export function createForgeGateway({ workerUrl, session, fetch }: Dependencies): ForgeGateway {
  async function send(request: ForgeRequest, accessToken: string, signal?: AbortSignal) {
    try {
      return await fetch(`${workerUrl}/forge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        ...(signal && { signal }),
      });
    } catch {
      if (signal?.aborted) throw new ForgeCancelledError('Forge cancelled');
      throw new ForgeError('network');
    }
  }

  return {
    async forge(request, signal) {
      let accessToken = await withSessionErrors(() => session.getAccessToken());
      let response = await send(request, accessToken, signal);
      if (response.status === 401) {
        const rejected = accessToken;
        accessToken = await withSessionErrors(() => session.refreshAfterUnauthorized(rejected));
        response = await send(request, accessToken, signal);
      }

      if (response.status === 401) throw new ForgeError('unauthorized');
      if (response.status === 403) throw new ForgeError('forbidden');
      if (response.status === 429) {
        throw new ForgeError('rate_limited', retryAfterSeconds(response));
      }
      if (response.status === 400) {
        // Seul le statut est journalisé : le corps peut citer des champs de la demande.
        console.error('Forge request rejected by the worker (400)');
        throw new ForgeError('invalid_request');
      }
      if (!response.ok) throw new ForgeError('unavailable');

      const parsed = forgeResponseSchema.safeParse(await response.json().catch(() => undefined));
      if (!parsed.success) {
        console.warn('Unexpected forge response from the worker');
        throw new ForgeError('unavailable');
      }
      return parsed.data;
    },
  };
}
