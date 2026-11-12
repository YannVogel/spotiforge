import { LIBRARY_BATCH_SIZE, markKnownTracks } from './familiarity';
import { SpotifyError } from './spotify';
import { makeResolvedTrack } from './test-fixtures';

const taste = { topArtists: ['Kavinsky'], recentArtists: ['The xx'], genres: [] };

function library(saved: ReadonlySet<string>) {
  return jest.fn(async (uris: readonly string[]) => uris.map((uri) => saved.has(uri)));
}

it('marque « connu » un titre présent dans la bibliothèque', async () => {
  const track = makeResolvedTrack(1, { known: false });
  const libraryContains = library(new Set([track.spotifyUri]));

  const [marked] = await markKnownTracks([track], { libraryContains, taste: null });

  expect(marked?.known).toBe(true);
});

it('marque « connu » un titre d’un artiste écouté, sans interroger la bibliothèque', async () => {
  const track = makeResolvedTrack(1, { artist: 'Kavinsky, Lovefoxxx', known: false });
  const libraryContains = library(new Set());

  const [marked] = await markKnownTracks([track], { libraryContains, taste });

  expect(marked?.known).toBe(true);
  expect(libraryContains).not.toHaveBeenCalled();
});

it('marque « découverte » un titre ni en bibliothèque ni d’un artiste écouté, malgré le LLM', async () => {
  const track = makeResolvedTrack(1, { artist: 'Desire', known: true });

  const [marked] = await markKnownTracks([track], {
    libraryContains: library(new Set()),
    taste,
  });

  expect(marked?.known).toBe(false);
});

it('se rabat sur l’estimation du LLM quand la bibliothèque ne répond pas', async () => {
  const tracks = [
    makeResolvedTrack(1, { artist: 'Desire', known: true }),
    makeResolvedTrack(2, { artist: 'Chromatics', known: false }),
  ];
  const libraryContains = jest.fn(async (): Promise<boolean[]> => {
    throw new SpotifyError('unavailable', 404);
  });

  const marked = await markKnownTracks(tracks, { libraryContains, taste: null });

  expect(marked.map((track) => track.known)).toEqual([true, false]);
});

it('vérifie par lots de 40, un appel par lot quelle que soit la longueur', async () => {
  const tracks = Array.from({ length: 95 }, (_, i) => makeResolvedTrack(i, { known: false }));
  const libraryContains = library(
    new Set([tracks[0]?.spotifyUri ?? '', tracks[90]?.spotifyUri ?? '']),
  );

  const marked = await markKnownTracks(tracks, { libraryContains, taste: null });

  expect(libraryContains).toHaveBeenCalledTimes(Math.ceil(95 / LIBRARY_BATCH_SIZE));
  for (const [uris] of libraryContains.mock.calls) {
    expect(uris.length).toBeLessThanOrEqual(LIBRARY_BATCH_SIZE);
  }
  expect(marked.filter((track) => track.known)).toHaveLength(2);
});

it('n’envoie pas deux fois la même URI', async () => {
  const track = makeResolvedTrack(1, { known: false });
  const libraryContains = library(new Set());

  await markKnownTracks([track, { ...track }], { libraryContains, taste: null });

  expect(libraryContains).toHaveBeenCalledWith([track.spotifyUri]);
});

it('s’arrête au premier lot en panne et garde l’estimation du LLM pour la suite', async () => {
  const tracks = Array.from({ length: 50 }, (_, i) => makeResolvedTrack(i, { known: true }));
  const libraryContains = jest
    .fn<Promise<boolean[]>, [readonly string[]]>()
    .mockImplementationOnce(async (uris) => uris.map(() => false))
    .mockRejectedValueOnce(new SpotifyError('rate_limited', 429));

  const marked = await markKnownTracks(tracks, { libraryContains, taste: null });

  expect(marked.slice(0, 40).every((track) => !track.known)).toBe(true);
  expect(marked.slice(40).every((track) => track.known)).toBe(true);
});

it('laisse remonter une session expirée', async () => {
  const libraryContains = jest.fn(async (): Promise<boolean[]> => {
    throw new SpotifyError('unauthorized', 401);
  });

  await expect(
    markKnownTracks([makeResolvedTrack(1)], { libraryContains, taste: null }),
  ).rejects.toThrow(new SpotifyError('unauthorized', 401));
});

it('garde les autres champs, y compris l’état de trempe', async () => {
  const track = { ...makeResolvedTrack(1, { known: false }), quenched: true };

  const [marked] = await markKnownTracks([track], {
    libraryContains: library(new Set()),
    taste: null,
  });

  expect(marked).toEqual({ ...track, known: false });
});
