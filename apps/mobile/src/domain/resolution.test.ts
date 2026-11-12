import type { Candidate } from '@spotiforge/shared';
import { makeCandidate } from '@spotiforge/shared/testing';

import type { CatalogTrack } from './match';
import type { CachedResolution, ResolutionCache } from './resolution-cache';
import { MAX_CONCURRENT_SEARCHES, resolveCandidates } from './resolution';
import { SpotifyError } from './spotify';

const NOW = new Date('2026-11-12T02:00:00.000Z');

function catalog(
  artist: string,
  title: string,
  overrides: Partial<CatalogTrack> = {},
): CatalogTrack {
  return {
    spotifyUri: `spotify:track:${artist}-${title}`.replace(/\s/g, ''),
    title,
    artists: [artist],
    year: 2010,
    durationMs: 240_000,
    ...overrides,
  };
}

function memoryCache() {
  const entries = new Map<string, CachedResolution>();
  const cache: ResolutionCache = {
    get: async (key) => entries.get(key),
    set: async (key, resolution) => {
      entries.set(key, resolution);
    },
  };
  return { cache, entries };
}

/** Recherche simulée : renvoie le titre demandé chez son artiste, sauf les titres « introuvables ». */
function fakeSearch(missing: string[] = []) {
  return jest.fn(async ({ artist, title }: { artist: string; title: string }) =>
    missing.includes(title) ? [catalog('Autre Artiste', title)] : [catalog(artist, title)],
  );
}

const candidate = (artist: string, title: string, extra: Partial<Candidate> = {}) =>
  makeCandidate({ artist, title, ...extra });

it('retrouve chaque candidat et garde sa raison, sa place et l’estimation « connu »', async () => {
  const search = fakeSearch();
  const { cache } = memoryCache();
  const nightcall = candidate('Kavinsky', 'Nightcall', {
    reason: 'La référence.',
    slot: 0.3,
    familiar: true,
    year: 2010,
  });

  const result = await resolveCandidates([nightcall], { search, cache, now: () => NOW });

  expect(result).toEqual({
    resolved: [
      {
        spotifyUri: 'spotify:track:Kavinsky-Nightcall',
        title: 'Nightcall',
        artist: 'Kavinsky',
        year: 2010,
        durationMs: 240_000,
        reason: 'La référence.',
        known: true,
        slot: 0.3,
      },
    ],
    discarded: [],
  });
});

it('écarte les introuvables plutôt que de garder un mauvais titre', async () => {
  const search = fakeSearch(['Titre fantôme']);
  const ghost = candidate('M83', 'Titre fantôme');

  const result = await resolveCandidates([ghost], {
    search,
    cache: memoryCache().cache,
    now: () => NOW,
  });

  expect(result).toEqual({ resolved: [], discarded: [{ candidate: ghost, reason: 'not_found' }] });
});

it('écarte les doublons, écrits pareil ou différemment, sans les rechercher deux fois', async () => {
  const search = jest.fn(async () => [catalog('Röyksopp', 'What Else Is There?')]);
  const first = candidate('Röyksopp', 'What Else Is There?');
  const sameKey = candidate('Royksopp', 'What else is there');
  const sameUri = candidate('Röyksopp', 'What Else Is There (Radio Edit)');

  const result = await resolveCandidates([first, sameKey, sameUri], {
    search,
    cache: memoryCache().cache,
    now: () => NOW,
  });

  expect(result.resolved).toHaveLength(1);
  expect(result.discarded).toEqual([
    { candidate: sameKey, reason: 'duplicate' },
    { candidate: sameUri, reason: 'duplicate' },
  ]);
  expect(search).toHaveBeenCalledTimes(1);
});

it('écarte les titres de avoid sans les rechercher, et les URI déjà prises', async () => {
  const search = fakeSearch();
  const refused = candidate('Chromatics', 'Tick of the Clock');
  const inPiece = candidate('M83', 'Midnight City');

  const result = await resolveCandidates(
    [refused, inPiece],
    { search, cache: memoryCache().cache, now: () => NOW },
    {
      avoid: [{ artist: 'chromatics', title: 'Tick Of The Clock' }],
      excludedUris: new Set(['spotify:track:M83-MidnightCity']),
    },
  );

  expect(result.discarded).toEqual([
    { candidate: refused, reason: 'avoided' },
    { candidate: inPiece, reason: 'avoided' },
  ]);
  expect(search).toHaveBeenCalledTimes(1);
});

it('garde les résolutions en cache, introuvables compris : un second passage ne cherche rien', async () => {
  const search = fakeSearch(['Introuvable']);
  const { cache, entries } = memoryCache();
  const list = [candidate('Kavinsky', 'Nightcall'), candidate('M83', 'Introuvable')];

  const first = await resolveCandidates(list, { search, cache, now: () => NOW });
  const second = await resolveCandidates(list, { search, cache, now: () => NOW });

  expect(search).toHaveBeenCalledTimes(2);
  expect(second).toEqual(first);
  expect([...entries.values()].map((entry) => entry.resolvedAt)).toEqual([
    NOW.toISOString(),
    NOW.toISOString(),
  ]);
});

it(`ne lance jamais plus de ${MAX_CONCURRENT_SEARCHES} recherches à la fois`, async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const search = jest.fn(async ({ artist, title }: { artist: string; title: string }) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return [catalog(artist, title)];
  });
  const list = Array.from({ length: 10 }, (_, i) => candidate(`Artiste ${i}`, `Titre ${i}`));

  const result = await resolveCandidates(list, {
    search,
    cache: memoryCache().cache,
    now: () => NOW,
  });

  expect(result.resolved).toHaveLength(10);
  expect(maxInFlight).toBe(MAX_CONCURRENT_SEARCHES);
});

it('remonte la progression au fil de l’eau', async () => {
  const onProgress = jest.fn();
  const list = [
    candidate('A', 'Un'),
    candidate('A', 'Un'),
    candidate('B', 'Deux'),
    candidate('C', 'Évité'),
  ];

  await resolveCandidates(
    list,
    { search: fakeSearch(), cache: memoryCache().cache, now: () => NOW, onProgress },
    { avoid: [{ artist: 'C', title: 'Évité' }] },
  );

  const calls = onProgress.mock.calls.map(([done, total]) => [done, total]);
  expect(calls[0]).toEqual([1, 4]);
  expect(calls.at(-1)).toEqual([4, 4]);
  expect(calls.map(([done]) => done)).toEqual(
    [...calls.map(([done]) => done)].sort((a, b) => (a ?? 0) - (b ?? 0)),
  );
});

it('un quota épuisé n’écarte que le titre concerné, sans le mettre en cache', async () => {
  const search = jest.fn(async ({ artist, title }: { artist: string; title: string }) => {
    if (title === 'Trop demandé') throw new SpotifyError('rate_limited', 429);
    return [catalog(artist, title)];
  });
  const { cache, entries } = memoryCache();
  const limited = candidate('A', 'Trop demandé');

  const result = await resolveCandidates([candidate('B', 'Normal'), limited], {
    search,
    cache,
    now: () => NOW,
  });

  expect(result.resolved).toHaveLength(1);
  expect(result.discarded).toEqual([{ candidate: limited, reason: 'unavailable' }]);
  expect(entries.size).toBe(1);
});

it('interrompt tout si Spotify est injoignable', async () => {
  const search = jest.fn(async () => {
    throw new SpotifyError('network');
  });

  await expect(
    resolveCandidates([candidate('A', 'Un')], {
      search,
      cache: memoryCache().cache,
      now: () => NOW,
    }),
  ).rejects.toThrow(new SpotifyError('network'));
});
