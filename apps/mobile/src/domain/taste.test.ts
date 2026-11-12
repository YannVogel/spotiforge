import { FORGE_LIMITS } from '@spotiforge/shared';

import { SpotifyError } from './spotify';
import {
  type CachedTaste,
  isTasteFresh,
  listenedArtistKeys,
  loadTaste,
  summarizeTaste,
  TASTE_TTL_MS,
  type TasteCache,
} from './taste';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe('summarizeTaste', () => {
  it('garde les noms des artistes et leurs genres, sans doublon', () => {
    const taste = summarizeTaste({
      topArtists: [
        { name: 'Kavinsky', genres: ['synthwave', 'french house'] },
        { name: '  Röyksopp ', genres: ['electronica'] },
        { name: 'Royksopp', genres: ['Electronica'] },
        { name: 'M83', genres: ['synthwave', 'shoegaze'] },
      ],
      recentArtists: ['Desire', 'Kavinsky', 'desire', ''],
    });

    expect(taste).toEqual({
      topArtists: ['Kavinsky', 'Röyksopp', 'M83'],
      recentArtists: ['Desire', 'Kavinsky'],
      genres: ['synthwave', 'electronica', 'french house', 'shoegaze'],
    });
  });

  it('respecte les bornes du contrat', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      name: `Artiste ${i} ${'x'.repeat(300)}`,
      genres: [`genre ${i}`],
    }));

    const taste = summarizeTaste({
      topArtists: many,
      recentArtists: many.map((artist) => artist.name),
    });

    expect(taste.topArtists).toHaveLength(FORGE_LIMITS.tasteArtists.max);
    expect(taste.recentArtists).toHaveLength(FORGE_LIMITS.tasteArtists.max);
    expect(taste.genres).toHaveLength(FORGE_LIMITS.tasteGenres.max);
    expect(Math.max(...taste.topArtists.map((name) => name.length))).toBeLessThanOrEqual(
      FORGE_LIMITS.text.maxLength,
    );
  });

  it('ne contient que des noms : aucun identifiant ni horodatage', () => {
    const taste = summarizeTaste({ topArtists: [{ name: 'M83', genres: [] }], recentArtists: [] });

    expect(Object.keys(taste).sort()).toEqual(['genres', 'recentArtists', 'topArtists']);
  });
});

describe('isTasteFresh', () => {
  it('vaut une journée', () => {
    expect(isTasteFresh({ taste: emptyTaste(), fetchedAt: hoursAgo(23) }, NOW)).toBe(true);
    expect(isTasteFresh({ taste: emptyTaste(), fetchedAt: hoursAgo(24) }, NOW)).toBe(false);
    expect(TASTE_TTL_MS).toBe(24 * 3_600_000);
  });

  it('ne fait pas confiance à une date dans le futur', () => {
    expect(isTasteFresh({ taste: emptyTaste(), fetchedAt: hoursAgo(-1) }, NOW)).toBe(false);
  });
});

it('listenedArtistKeys normalise les artistes écoutés', () => {
  const keys = listenedArtistKeys({
    topArtists: ['Röyksopp'],
    recentArtists: ['The xx'],
    genres: [],
  });

  expect(keys.has('royksopp')).toBe(true);
  expect(keys.size).toBe(2);
});

describe('loadTaste', () => {
  function setup({
    cached,
    top = async () => [{ name: 'Kavinsky', genres: ['synthwave'] }],
    recent = async () => ['M83'],
  }: {
    cached?: CachedTaste;
    top?: () => Promise<{ name: string; genres: string[] }[]>;
    recent?: () => Promise<string[]>;
  } = {}) {
    const stored = new Map<string, CachedTaste>(cached ? [['owner-a', cached]] : []);
    const cache: TasteCache = {
      get: jest.fn(async (owner: string) => stored.get(owner)),
      set: jest.fn(async (owner: string, value: CachedTaste) => {
        stored.set(owner, value);
      }),
    };
    const gateway = { getTopArtists: jest.fn(top), getRecentlyPlayedArtists: jest.fn(recent) };
    const load = () => loadTaste({ gateway, cache, ownerSpotifyId: 'owner-a', now: () => NOW });
    return { load, gateway, cache, stored };
  }

  it('lit Spotify, résume et garde le résumé', async () => {
    const { load, stored } = setup();

    expect(await load()).toEqual({
      status: 'ready',
      taste: { topArtists: ['Kavinsky'], recentArtists: ['M83'], genres: ['synthwave'] },
    });
    expect(stored.get('owner-a')?.fetchedAt).toBe(NOW.toISOString());
  });

  it('ne relit pas Spotify tant que le résumé est frais', async () => {
    const cachedTaste = { topArtists: ['Desire'], recentArtists: [], genres: [] };
    const { load, gateway } = setup({ cached: { taste: cachedTaste, fetchedAt: hoursAgo(2) } });

    expect(await load()).toEqual({ status: 'ready', taste: cachedTaste });
    expect(gateway.getTopArtists).not.toHaveBeenCalled();
    expect(gateway.getRecentlyPlayedArtists).not.toHaveBeenCalled();
  });

  it('relit Spotify quand le résumé a expiré', async () => {
    const { load, gateway } = setup({ cached: { taste: emptyTaste(), fetchedAt: hoursAgo(30) } });

    expect((await load()).status).toBe('ready');
    expect(gateway.getTopArtists).toHaveBeenCalledTimes(1);
  });

  it('se contente d’une seule des deux lectures', async () => {
    const { load } = setup({
      recent: async () => {
        throw new SpotifyError('unavailable', 404);
      },
    });

    expect(await load()).toEqual({
      status: 'ready',
      taste: { topArtists: ['Kavinsky'], recentArtists: [], genres: ['synthwave'] },
    });
  });

  it('se déclare indisponible quand Spotify ne donne aucune écoute, sans échouer', async () => {
    const fail = async (): Promise<never> => {
      throw new SpotifyError('unavailable', 404);
    };
    const { load, cache } = setup({ top: fail, recent: fail });

    expect(await load()).toEqual({ status: 'unavailable' });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reprend un ancien résumé plutôt que rien quand Spotify ne répond pas', async () => {
    const old = { topArtists: ['Desire'], recentArtists: [], genres: [] };
    const fail = async (): Promise<never> => {
      throw new SpotifyError('network');
    };
    const { load } = setup({
      cached: { taste: old, fetchedAt: hoursAgo(72) },
      top: fail,
      recent: fail,
    });

    expect(await load()).toEqual({ status: 'ready', taste: old });
  });

  it('laisse remonter une session expirée', async () => {
    const { load } = setup({
      top: async () => {
        throw new SpotifyError('unauthorized', 401);
      },
    });

    await expect(load()).rejects.toThrow(new SpotifyError('unauthorized', 401));
  });

  it('laisse remonter une erreur qui ne vient pas de Spotify', async () => {
    const { load } = setup({
      recent: async () => {
        throw new TypeError('bug');
      },
    });

    await expect(load()).rejects.toThrow(TypeError);
  });
});

function emptyTaste() {
  return { topArtists: [], recentArtists: [], genres: [] };
}
