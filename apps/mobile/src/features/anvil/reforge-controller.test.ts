import { makeCandidate, makeForgeResponse, makeForgeSettings } from '@spotiforge/shared/testing';

import { ForgeError } from '../../domain/forge';
import { makePieceRecord } from '../../infra/db/fixtures';
import type { ForgeControllerDependencies } from '../forge/forge-controller';
import { fakeForgeDependencies } from '../forge/testing/fake-forge';
import { useAnvilStore } from './anvil-store';
import { startReforge } from './reforge-controller';

// Trois titres visés, un seul à chaud : une reforge, un appel au Worker (pas de complément).
const record = makePieceRecord({
  settings: makeForgeSettings({ length: { unit: 'tracks', value: 3 } }),
});
const getDeps = (deps: ForgeControllerDependencies) => async () => deps;

beforeEach(() => {
  useAnvilStore.setState(useAnvilStore.getInitialState(), true);
  useAnvilStore.getState().open(record);
});

function reforgeable() {
  return fakeForgeDependencies({
    respond: (_request, call) =>
      makeForgeResponse({
        candidates: [makeCandidate({ artist: `Neuf ${call}`, title: `Nouveauté ${call}` })],
      }),
  });
}

it('remplace la pièce sur l’enclume par la pièce reforgée', async () => {
  const { deps } = reforgeable();

  const running = startReforge(getDeps(deps));
  expect(useAnvilStore.getState().reforge).toEqual({ status: 'reforging' });
  await running;

  const after = useAnvilStore.getState();
  expect(after.reforge).toEqual({ status: 'idle' });
  expect(after.record?.tracks[1]?.artist).toBe('Neuf 1');
  expect(after.record?.rejected.map((t) => t.title)).toContain(record.tracks[1]?.title);
});

it('en cas d’échec, garde la pièce telle quelle et affiche le motif', async () => {
  const { deps } = fakeForgeDependencies({ forgeError: new ForgeError('network') });

  await startReforge(getDeps(deps));

  expect(useAnvilStore.getState().record).toEqual(record);
  expect(useAnvilStore.getState().reforge).toEqual({
    status: 'failed',
    failure: { kind: 'offline' },
  });
});

it('ignore un second appui et fige la trempe pendant la reforge', async () => {
  const { deps, forge } = reforgeable();

  const first = startReforge(getDeps(deps));
  await startReforge(getDeps(deps));
  useAnvilStore.getState().toggleQuench(record.tracks[1]?.spotifyUri ?? '');
  expect(useAnvilStore.getState().record?.tracks[1]?.quenched).toBe(false);
  await first;

  expect(forge.forge).toHaveBeenCalledTimes(1);
});

it('ne pose pas le résultat sur une autre pièce ouverte entre-temps', async () => {
  const { deps } = reforgeable();
  const other = makePieceRecord({ id: 'piece-2' });

  const running = startReforge(getDeps(deps));
  useAnvilStore.getState().open(other);
  await running;

  expect(useAnvilStore.getState().record).toEqual(other);
});
