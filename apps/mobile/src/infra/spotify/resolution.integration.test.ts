import { makeCandidate } from '@spotiforge/shared/testing';

import { resolveCandidates } from '../../domain/resolution';
import { migrate } from '../db/migrations';
import { createResolutionCache } from '../db/resolution-cache';
import { createMemoryDatabase } from '../db/testing/node-sql-database';
import { createSpotifyGateway } from './gateway';
import { createSpotifyHttp } from './http';

// Chaîne réelle : client HTTP (Spotify simulé au niveau de fetch), passerelle, cache SQLite,
// résolution du domaine.

function searchReply(artist: string, title: string) {
  return Response.json({
    tracks: {
      items: [
        null,
        { uri: 'spotify:track:incomplet', name: title },
        {
          uri: `spotify:track:${title.length}${artist.length}`,
          name: title,
          duration_ms: 230_000,
          artists: [{ name: artist }],
          album: { release_date: '2011-10-17', album_type: 'album' },
          popularity: 99,
        },
      ],
    },
  });
}

async function setup(script: (q: string, call: number) => Response) {
  const db = createMemoryDatabase();
  await migrate(db);
  const urls: URL[] = [];
  const fetch = jest.fn(async (input: string) => {
    const url = new URL(input);
    urls.push(url);
    return script(url.searchParams.get('q') ?? '', urls.length);
  });
  const sleep = jest.fn(async (_ms: number) => {});
  const request = createSpotifyHttp({
    session: { getAccessToken: async () => 't', refreshAfterUnauthorized: async () => 't' },
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep,
  });
  const gateway = createSpotifyGateway(request);
  const deps = {
    search: gateway.searchTracks,
    cache: createResolutionCache(db),
    now: () => new Date('2026-11-12T02:00:00.000Z'),
  };
  return { deps, fetch, sleep, urls };
}

const list = [
  makeCandidate({ artist: 'M83', title: 'Midnight City', year: 2011 }),
  makeCandidate({ artist: 'Kavinsky', title: 'Nightcall', year: 2010 }),
  makeCandidate({ artist: 'Desire', title: 'Under Your Spell', year: 2009 }),
];

/** Répond à la recherche d'après le filtre `track:… artist:…` de la requête. */
function answer(q: string) {
  const match = /^track:(.*) artist:(.*)$/.exec(q);
  return searchReply(match?.[2] ?? '', match?.[1] ?? '');
}

it('cherche chaque candidat avec les bons paramètres et ignore les résultats incomplets', async () => {
  const { deps, urls } = await setup((q) => answer(q));

  const result = await resolveCandidates(list, deps);

  expect(result.resolved.map((track) => [track.title, track.artist, track.year])).toEqual([
    ['Midnight City', 'M83', 2011],
    ['Nightcall', 'Kavinsky', 2011],
    ['Under Your Spell', 'Desire', 2011],
  ]);
  expect(urls[0]?.pathname).toBe('/v1/search');
  expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
    q: 'track:Midnight City artist:M83',
    type: 'track',
    limit: '10',
  });
});

it('un 429 au milieu ralentit la résolution sans la faire échouer', async () => {
  const { deps, sleep } = await setup((q, call) =>
    call === 2 ? new Response(null, { status: 429, headers: { 'Retry-After': '1' } }) : answer(q),
  );

  const result = await resolveCandidates(list, deps);

  expect(result.resolved).toHaveLength(3);
  expect(result.discarded).toEqual([]);
  expect(sleep).toHaveBeenCalledWith(1000);
});

it('un second passage sur les mêmes candidats ne fait aucun appel réseau', async () => {
  const { deps, fetch } = await setup((q) => answer(q));

  const first = await resolveCandidates(list, deps);
  fetch.mockClear();
  const second = await resolveCandidates(list, deps);

  expect(fetch).not.toHaveBeenCalled();
  expect(second).toEqual(first);
});
