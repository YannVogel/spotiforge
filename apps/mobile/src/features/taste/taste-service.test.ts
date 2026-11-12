import { createDraft, setPrompt, setUseTaste } from '../../domain/draft';
import { SpotifyError } from '../../domain/spotify';
import type { CachedTaste } from '../../domain/taste';
import { forgeRequestWithTaste, loadTasteForForge } from './taste-service';
import { useAlloyStore } from './taste-store';

const taste = { topArtists: ['Kavinsky'], recentArtists: ['M83'], genres: ['synthwave'] };
const draft = (useTaste: boolean) =>
  setUseTaste(setPrompt(createDraft(), 'Route de nuit'), useTaste);

beforeEach(() => {
  useAlloyStore.setState(useAlloyStore.getInitialState(), true);
});

function dependencies(fail: boolean) {
  const stored = new Map<string, CachedTaste>();
  const read = async <T>(value: T) => {
    if (fail) throw new SpotifyError('unavailable', 404);
    return value;
  };
  return {
    gateway: {
      getTopArtists: () => read([{ name: 'Kavinsky', genres: ['synthwave'] }]),
      getRecentlyPlayedArtists: () => read(['M83']),
    },
    cache: {
      get: async (owner: string) => stored.get(owner),
      set: async (owner: string, value: CachedTaste) => {
        stored.set(owner, value);
      },
    },
    ownerSpotifyId: 'owner-a',
    now: () => new Date('2026-11-12T12:00:00Z'),
  };
}

it('avec l’alliage activé, la requête contient le résumé des écoutes', async () => {
  const result = await loadTasteForForge(dependencies(false));

  expect(forgeRequestWithTaste(draft(true), result).taste).toEqual(taste);
  expect(useAlloyStore.getState().availability).toBe('available');
});

it('sans l’alliage, la requête ne contient pas le résumé, même lu', async () => {
  const result = await loadTasteForForge(dependencies(false));

  expect(result.status).toBe('ready');
  expect(forgeRequestWithTaste(draft(false), result)).not.toHaveProperty('taste');
});

it('si Spotify ne donne pas les écoutes, la forge part sans alliage et l’écran le saura', async () => {
  const result = await loadTasteForForge(dependencies(true));

  expect(forgeRequestWithTaste(draft(true), result)).not.toHaveProperty('taste');
  expect(useAlloyStore.getState().availability).toBe('unavailable');
});
