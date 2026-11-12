import type { ForgeRequest, ForgeResponse } from '@spotiforge/shared';
import { makeCandidates, makeForgeResponse } from '@spotiforge/shared/testing';

import {
  createDraft,
  setLengthUnit,
  setLengthValue,
  setPrompt,
  setUseTaste,
} from '../../domain/draft';
import { ForgeCancelledError, ForgeError } from '../../domain/forge';
import type { CatalogTrack } from '../../domain/match';
import type { CachedResolution } from '../../domain/resolution-cache';
import { SpotifyError } from '../../domain/spotify';
import type { CachedTaste } from '../../domain/taste';
import { useAlloyStore } from '../taste/taste-store';
import { type ForgeProgress, NoTracksFoundError, runForge } from './forge-run';

// Passerelles simulées : un Worker qui répond `responses` dans l'ordre, un Spotify qui trouve
// chaque candidat sauf ceux de `missing`.

const NOW = new Date('2026-11-12T12:00:00.000Z');

function catalogTrack(artist: string, title: string): CatalogTrack {
  return {
    spotifyUri: `spotify:track:${artist}-${title}`.replace(/\s+/g, '_'),
    title,
    artists: [artist],
    year: 2000,
    durationMs: 240_000,
  };
}

function setup({
  responses = [makeForgeResponse({ candidates: makeCandidates(15) })],
  missing = new Set<string>(),
  forgeError,
  library = new Set<string>(),
}: {
  responses?: ForgeResponse[];
  missing?: ReadonlySet<string>;
  forgeError?: Error;
  library?: ReadonlySet<string>;
} = {}) {
  const requests: ForgeRequest[] = [];
  const forge = {
    forge: jest.fn(async (request: ForgeRequest) => {
      requests.push(request);
      if (forgeError) throw forgeError;
      const response = responses.shift();
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
  const deps = {
    forge,
    spotify,
    resolutionCache: {
      get: async (key: string) => resolutions.get(key),
      set: async (key: string, value: CachedResolution) => {
        resolutions.set(key, value);
      },
    },
    tasteCache: {
      get: async (owner: string) => tastes.get(owner),
      set: async (owner: string, value: CachedTaste) => {
        tastes.set(owner, value);
      },
    },
    ownerSpotifyId: 'owner-a',
    now: () => NOW,
    newId: () => `piece-${++id}`,
    onProgress: (step: ForgeProgress) => progress.push(step),
  };
  return { deps, forge, spotify, requests, progress };
}

const draft = (tracks = 10, useTaste = false) =>
  setUseTaste(
    setLengthValue(setLengthUnit(setPrompt(createDraft(), 'Route de nuit'), 'tracks'), tracks),
    useTaste,
  );

beforeEach(() => {
  useAlloyStore.setState(useAlloyStore.getInitialState(), true);
});

it('mène du minerai à une pièce de titres réels, dans l’ordre de la progression', async () => {
  const { deps, requests, progress } = setup();
  const source = draft(10);

  const record = await runForge(source, deps);

  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    prompt: 'Route de nuit',
    length: { unit: 'tracks', value: 10 },
  });
  expect(record).toMatchObject({
    id: 'piece-1',
    ownerSpotifyId: 'owner-a',
    title: 'Route de nuit',
    prompt: 'Route de nuit',
    settings: source.settings,
    spotifyPlaylistId: null,
    createdAt: NOW.toISOString(),
    sentAt: null,
    rejected: [],
  });
  expect(record.tracks).toHaveLength(10);
  expect(record.tracks.map((track) => track.title)).toEqual(
    Array.from({ length: 10 }, (_, i) => `Titre ${i + 1}`),
  );
  expect(record.tracks.every((track) => !track.quenched)).toBe(true);
  expect(progress.map((step) => step.stage)).toEqual(
    expect.arrayContaining(['listening', 'forging', 'resolving', 'marking']),
  );
  expect(progress.at(-2)).toEqual({ stage: 'resolving', done: 15, total: 15 });
});

it('marque connus les titres d’un artiste écouté ou de la bibliothèque', async () => {
  const library = new Set([catalogTrack('Artiste 1', 'Titre 1').spotifyUri]);
  const { deps } = setup({ library });

  const record = await runForge(draft(5), deps);

  expect(record.tracks.map((track) => track.known)).toEqual([true, true, false, true, false]);
});

it('envoie le résumé des écoutes seulement avec l’alliage', async () => {
  const withAlloy = setup();
  await runForge(draft(5, true), withAlloy.deps);
  expect(withAlloy.requests[0]?.taste?.topArtists).toEqual(['Artiste 2']);

  const without = setup();
  await runForge(draft(5, false), without.deps);
  expect(without.requests[0]).not.toHaveProperty('taste');
});

it('relance une forge complémentaire, une seule fois, s’il manque plus d’un titre sur cinq', async () => {
  // 15 candidats, 8 introuvables : 7 titres pour 10 visés.
  const missing = new Set(Array.from({ length: 8 }, (_, i) => `Titre ${i + 8}`));
  const complement = makeForgeResponse({
    candidates: makeCandidates(20).slice(15),
  });
  const { deps, requests } = setup({
    responses: [makeForgeResponse({ candidates: makeCandidates(15) }), complement],
    missing,
  });

  const record = await runForge(draft(10), deps);

  expect(requests).toHaveLength(2);
  const second = requests[1];
  expect(second?.keep?.map((track) => track.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(second?.avoid).toEqual(
    expect.arrayContaining([{ artist: 'Artiste 8', title: 'Titre 8' }]),
  );
  expect(record.tracks).toHaveLength(10);
  expect(record.title).toBe('Route de nuit');
});

it('ne relance pas de complément s’il manque au plus un titre sur cinq', async () => {
  const missing = new Set([
    'Titre 1',
    'Titre 2',
    'Titre 3',
    'Titre 4',
    'Titre 5',
    'Titre 6',
    'Titre 7',
  ]);
  const { deps, requests } = setup({ missing });

  const record = await runForge(draft(10), deps);

  expect(requests).toHaveLength(1);
  expect(record.tracks).toHaveLength(8);
});

it('affiche ce qu’on a après le complément, même incomplet', async () => {
  const everything = new Set(Array.from({ length: 30 }, (_, i) => `Titre ${i + 3}`));
  const { deps, requests } = setup({
    responses: [makeForgeResponse(), makeForgeResponse({ candidates: makeCandidates(6) })],
    missing: everything,
  });

  const record = await runForge(draft(10), deps);

  expect(requests).toHaveLength(2);
  expect(record.tracks.map((track) => track.title)).toEqual(['Titre 1', 'Titre 2']);
});

it('échoue proprement quand aucun titre n’existe sur Spotify', async () => {
  const everything = new Set(Array.from({ length: 30 }, (_, i) => `Titre ${i + 1}`));
  const { deps } = setup({
    responses: [makeForgeResponse(), makeForgeResponse()],
    missing: everything,
  });

  await expect(runForge(draft(10), deps)).rejects.toThrow(NoTracksFoundError);
});

it.each([
  ['403', new ForgeError('forbidden')],
  ['429', new ForgeError('rate_limited', 600)],
  ['502', new ForgeError('unavailable')],
  ['hors ligne', new ForgeError('network')],
])('laisse remonter l’erreur du Worker (%s) sans rien produire', async (_label, error) => {
  const { deps, spotify } = setup({ forgeError: error });

  await expect(runForge(draft(10), deps)).rejects.toBe(error);
  expect(spotify.searchTracks).not.toHaveBeenCalled();
});

it('laisse remonter une panne de Spotify pendant la résolution', async () => {
  const { deps, spotify } = setup();
  spotify.searchTracks.mockRejectedValue(new SpotifyError('network'));

  await expect(runForge(draft(10), deps)).rejects.toThrow(new SpotifyError('network'));
});

it('s’arrête dès l’annulation, sans résoudre ni marquer', async () => {
  const controller = new AbortController();
  const { deps, forge, spotify } = setup();
  forge.forge.mockImplementationOnce(async () => {
    controller.abort();
    return makeForgeResponse();
  });

  await expect(runForge(draft(10), { ...deps, signal: controller.signal })).rejects.toThrow(
    ForgeCancelledError,
  );
  expect(spotify.searchTracks).not.toHaveBeenCalled();
  expect(spotify.libraryContains).not.toHaveBeenCalled();
});

it('ne modifie jamais le brouillon', async () => {
  const { deps } = setup();
  const source = draft(10);
  const before = JSON.stringify(source);

  const record = await runForge(source, deps);

  expect(JSON.stringify(source)).toBe(before);
  expect(record.settings).not.toBe(source.settings);
});
