import { makeForgeResponse } from '@spotiforge/shared/testing';

import { createDraft, setPrompt } from '../../domain/draft';
import { ForgeError } from '../../domain/forge';
import { cancelForge, type ForgeControllerDependencies, startForge } from './forge-controller';
import { useForgeStore } from './forge-store';

const draft = setPrompt(createDraft(), 'Route de nuit');

function dependencies(forge: ForgeControllerDependencies['forge']['forge']) {
  return async (): Promise<ForgeControllerDependencies> => ({
    forge: { forge },
    spotify: {
      searchTracks: async ({ artist, title }) => [
        { spotifyUri: `spotify:track:${title}`, title, artists: [artist], durationMs: 240_000 },
      ],
      getTopArtists: async () => [],
      getRecentlyPlayedArtists: async () => [],
      libraryContains: async (uris) => uris.map(() => false),
    },
    resolutionCache: { get: async () => undefined, set: async () => {} },
    tasteCache: { get: async () => undefined, set: async () => {} },
    ownerSpotifyId: 'owner-a',
    now: () => new Date('2026-11-12T12:00:00Z'),
    newId: () => 'piece-1',
  });
}

/** Une forge qu'on termine à la main, pour observer l'état pendant qu'elle tourne. */
function pendingForge() {
  let finish: () => void = () => {};
  let markStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const forge = jest.fn(
    () =>
      new Promise<ReturnType<typeof makeForgeResponse>>((resolve) => {
        finish = () => resolve(makeForgeResponse());
        markStarted();
      }),
  );
  return { forge, started, finish: () => finish() };
}

beforeEach(() => {
  useForgeStore.setState(useForgeStore.getInitialState(), true);
});

it('passe par « forge en cours » puis remet la pièce, et revient au repos', async () => {
  const { forge, started, finish } = pendingForge();
  const onForged = jest.fn();

  const running = startForge(draft, dependencies(forge), onForged);
  expect(useForgeStore.getState().state.status).toBe('forging');
  await started;
  expect(useForgeStore.getState().state).toEqual({
    status: 'forging',
    progress: { stage: 'forging' },
  });
  finish();
  await running;

  expect(onForged).toHaveBeenCalledWith(expect.objectContaining({ id: 'piece-1' }));
  expect(useForgeStore.getState().state).toEqual({ status: 'idle' });
});

it('ignore un second appui pendant la forge', async () => {
  const { forge, started, finish } = pendingForge();
  const onForged = jest.fn();

  const first = startForge(draft, dependencies(forge), onForged);
  await startForge(draft, dependencies(forge), onForged);
  await started;
  finish();
  await first;

  expect(forge).toHaveBeenCalledTimes(1);
  expect(onForged).toHaveBeenCalledTimes(1);
});

it('annuler ramène au repos sans message ni pièce', async () => {
  const { forge, started, finish } = pendingForge();
  const onForged = jest.fn();

  const running = startForge(draft, dependencies(forge), onForged);
  await started;
  cancelForge();
  finish();
  await running;

  expect(onForged).not.toHaveBeenCalled();
  expect(useForgeStore.getState().state).toEqual({ status: 'idle' });
});

it('un échec est affiché avec son motif, et une nouvelle forge reste possible', async () => {
  const failing = jest.fn(async () => {
    throw new ForgeError('rate_limited', 600);
  });

  await startForge(draft, dependencies(failing), jest.fn());
  expect(useForgeStore.getState().state).toEqual({
    status: 'failed',
    failure: { kind: 'rate_limited', retryAfterMinutes: 10 },
  });

  const onForged = jest.fn();
  await startForge(
    draft,
    dependencies(async () => makeForgeResponse()),
    onForged,
  );
  expect(onForged).toHaveBeenCalledTimes(1);
});

it('une dépendance indisponible (pas de session) devient un échec affichable', async () => {
  await startForge(
    draft,
    async () => {
      throw new ForgeError('unauthorized');
    },
    jest.fn(),
  );

  expect(useForgeStore.getState().state).toEqual({
    status: 'failed',
    failure: { kind: 'signed_out' },
  });
});
