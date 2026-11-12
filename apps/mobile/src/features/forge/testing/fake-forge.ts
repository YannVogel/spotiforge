// Passerelles simulées pour les tests de la forge et de la reforge (données inventées) : un Worker
// qui répond `responses` dans l'ordre, un Spotify qui trouve chaque candidat sauf ceux de `missing`.
import type { ForgeRequest, ForgeResponse } from '@spotiforge/shared';
import { makeCandidates, makeForgeResponse } from '@spotiforge/shared/testing';

import type { CatalogTrack } from '../../../domain/match';
import type { CachedResolution } from '../../../domain/resolution-cache';
import type { CachedTaste } from '../../../domain/taste';
import type { ForgeProgress, ForgeRunDependencies } from '../forge-run';

export const NOW = new Date('2026-11-12T12:00:00.000Z');

export function catalogTrack(artist: string, title: string): CatalogTrack {
  return {
    spotifyUri: `spotify:track:${artist}-${title}`.replace(/\s+/g, '_'),
    title,
    artists: [artist],
    year: 2000,
    durationMs: 240_000,
  };
}

type FakeOptions = {
  responses?: ForgeResponse[];
  /** Ou une fonction : la réponse à chaque requête, d'après la requête. */
  respond?: (request: ForgeRequest, call: number) => ForgeResponse;
  missing?: ReadonlySet<string>;
  forgeError?: Error;
  library?: ReadonlySet<string>;
};

export function fakeForgeDependencies({
  responses = [makeForgeResponse({ candidates: makeCandidates(15) })],
  respond,
  missing = new Set<string>(),
  forgeError,
  library = new Set<string>(),
}: FakeOptions = {}) {
  const requests: ForgeRequest[] = [];
  const forge = {
    forge: jest.fn(async (request: ForgeRequest) => {
      requests.push(request);
      if (forgeError) throw forgeError;
      const response = respond ? respond(request, requests.length) : responses.shift();
      if (!response) throw new Error('No more fake forge responses');
      return response;
    }),
  };
  const spotify = {
    searchTracks: jest.fn(async ({ artist, title }: { artist: string; title: string }) =>
      missing.has(title) ? [] : [catalogTrack(artist, title)],
    ),
    getTopArtists: jest.fn(async () => [{ name: 'Artiste 2', genres: ['synthwave'] }]),
    getRecentlyPlayedArtists: jest.fn(async () => ['Artiste 4']),
    libraryContains: jest.fn(async (uris: readonly string[]) => uris.map((u) => library.has(u))),
  };
  const resolutions = new Map<string, CachedResolution>();
  const tastes = new Map<string, CachedTaste>();
  let id = 0;
  const progress: ForgeProgress[] = [];
  const deps: ForgeRunDependencies = {
    forge,
    spotify,
    resolutionCache: {
      get: async (key) => resolutions.get(key),
      set: async (key, value) => {
        resolutions.set(key, value);
      },
    },
    tasteCache: {
      get: async (owner) => tastes.get(owner),
      set: async (owner, value) => {
        tastes.set(owner, value);
      },
    },
    ownerSpotifyId: 'owner-a',
    now: () => NOW,
    newId: () => `piece-${++id}`,
    onProgress: (step) => progress.push(step),
  };
  return { deps, forge, spotify, requests, progress };
}
