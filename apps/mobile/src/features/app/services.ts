import { randomUUID } from 'expo-crypto';

import { getAppConfig } from '../../infra/config';
import { openAppDatabase } from '../../infra/db/open-database';
import { createMoldRepository } from '../../infra/db/mold-repository';
import { createPieceRepository } from '../../infra/db/piece-repository';
import { createResolutionCache } from '../../infra/db/resolution-cache';
import { createTasteCache } from '../../infra/db/taste-cache';
import { createForgeGateway } from '../../infra/forge/worker-client';
import { createSecureSessionStorage } from '../../infra/secure/session-storage';
import { fetchSpotifyAccount } from '../../infra/spotify/account';
import { createSpotifyGateway } from '../../infra/spotify/gateway';
import { createSpotifyHttp } from '../../infra/spotify/http';
import { refreshSpotifyTokens } from '../../infra/spotify/token-refresh';
import { createSessionManager } from '../session/session-manager';

/**
 * Racine de composition : le seul endroit qui relie le domaine à l'infra réelle (Spotify, Worker,
 * SQLite, stockage sécurisé). Tout le reste reçoit ses dépendances, ce qui le garde testable.
 */
async function createAppServices() {
  const config = getAppConfig();
  const session = createSessionManager({
    storage: createSecureSessionStorage(),
    refreshTokens: (tokens) => refreshSpotifyTokens(config.spotifyClientId, tokens),
    fetchAccount: (accessToken) => fetchSpotifyAccount(accessToken),
    now: () => Date.now(),
  });
  const request = createSpotifyHttp({
    session,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  const db = await openAppDatabase();
  // Reprend la session gardée, sans réseau : l'historique reste lisible hors ligne.
  await session.restore();

  return {
    config,
    session,
    spotify: createSpotifyGateway(request),
    forge: createForgeGateway({
      workerUrl: config.workerUrl,
      session,
      fetch: (input, init) => fetch(input, init),
    }),
    pieces: createPieceRepository(db),
    molds: createMoldRepository(db),
    resolutionCache: createResolutionCache(db),
    tasteCache: createTasteCache(db),
    now: () => new Date(),
    newId: () => randomUUID(),
  };
}

export type AppServices = Awaited<ReturnType<typeof createAppServices>>;

let services: Promise<AppServices> | undefined;

/** Les services de l'app, créés une fois ; un échec (base illisible…) laisse réessayer. */
export function getAppServices(): Promise<AppServices> {
  services ??= createAppServices().catch((error: unknown) => {
    services = undefined;
    throw error;
  });
  return services;
}
