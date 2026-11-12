import type { ForgeRequest } from '@spotiforge/shared';
import { makeCandidate, makeForgeResponse, makeForgeSettings } from '@spotiforge/shared/testing';

import { ForgeError } from '../../domain/forge';
import type { PieceRecord } from '../../domain/history';
import { makePieceTrack } from '../../domain/test-fixtures';
import { makePieceRecord } from '../../infra/db/fixtures';
import { NoTracksFoundError, runReforge } from './forge-run';
import { catalogTrack, fakeForgeDependencies as setup, NOW } from './testing/fake-forge';

// Une pièce de 5 titres, dont 2 trempés (positions 1 et 3), forgée plus tôt.
function piece(): PieceRecord {
  const track = (n: number, quenched: boolean) => {
    const found = catalogTrack(`Ancien ${n}`, `Morceau ${n}`);
    return makePieceTrack(n, {
      spotifyUri: found.spotifyUri,
      artist: `Ancien ${n}`,
      title: `Morceau ${n}`,
      slot: n / 4,
      quenched,
    });
  };
  return makePieceRecord({
    title: 'Titre modifié à la main',
    description: 'Description modifiée à la main',
    settings: makeForgeSettings({ length: { unit: 'tracks', value: 5 } }),
    tracks: [track(0, false), track(1, true), track(2, false), track(3, true), track(4, false)],
    rejected: [],
    updatedAt: '2026-11-10T20:00:00.000Z',
  });
}

/** Le Worker propose `count` titres neufs à chaque appel, et ressert aussi des titres à éviter. */
function freshCandidates(count: number, offset: number, avoid: ForgeRequest['avoid'] = []) {
  const fresh = Array.from({ length: count }, (_, i) =>
    makeCandidate({
      artist: `Neuf ${offset + i}`,
      title: `Nouveauté ${offset + i}`,
      slot: (i + 0.5) / count,
    }),
  );
  const replayed = (avoid ?? []).slice(0, 2).map((ref) => makeCandidate({ ...ref, slot: 0.5 }));
  return makeForgeResponse({ title: 'Autre titre', candidates: [...replayed, ...fresh] });
}

it('ne remplace que les titres à chaud : les trempés gardent leur place', async () => {
  const before = piece();
  const { deps, requests } = setup({
    respond: (request, call) => freshCandidates(5, call * 10, request.avoid),
  });

  const after = await runReforge(before, deps);

  expect(after.tracks).toHaveLength(5);
  expect(after.tracks[1]).toEqual(before.tracks[1]);
  expect(after.tracks[3]).toEqual(before.tracks[3]);
  for (const position of [0, 2, 4]) {
    expect(after.tracks[position]?.artist).toMatch(/^Neuf /);
    expect(after.tracks[position]?.quenched).toBe(false);
  }
  expect(requests[0]?.keep).toEqual([
    { position: 1, artist: 'Ancien 1', title: 'Morceau 1' },
    { position: 3, artist: 'Ancien 3', title: 'Morceau 3' },
  ]);
  expect(requests[0]?.avoid).toEqual(
    expect.arrayContaining([{ artist: 'Ancien 0', title: 'Morceau 0' }]),
  );
});

it('garde le titre et la description, et range les remplacés parmi les refusés', async () => {
  const before = piece();
  const { deps } = setup({
    respond: (request, call) => freshCandidates(5, call * 10, request.avoid),
  });

  const after = await runReforge(before, deps);

  expect(after.title).toBe('Titre modifié à la main');
  expect(after.description).toBe('Description modifiée à la main');
  expect(after.updatedAt).toBe(NOW.toISOString());
  expect(after.rejected.map((track) => track.title)).toEqual([
    'Morceau 0',
    'Morceau 2',
    'Morceau 4',
  ]);
});

it('dix reforges d’affilée ne font revenir aucun titre déjà refusé', async () => {
  const { deps } = setup({
    respond: (request, call) => freshCandidates(5, call * 10, request.avoid),
  });
  let current = piece();
  const everRejected = new Set<string>();

  for (let round = 0; round < 10; round++) {
    current = await runReforge(current, deps);
    for (const track of current.tracks) expect(everRejected.has(track.spotifyUri)).toBe(false);
    for (const track of current.rejected) everRejected.add(track.spotifyUri);
  }

  expect(everRejected.size).toBe(30);
  expect(current.tracks.filter((track) => track.quenched)).toHaveLength(2);
});

it('un échec laisse la pièce intacte', async () => {
  const before = piece();
  const snapshot = JSON.stringify(before);
  const { deps } = setup({ forgeError: new ForgeError('unavailable') });

  await expect(runReforge(before, deps)).rejects.toThrow(new ForgeError('unavailable'));
  expect(JSON.stringify(before)).toBe(snapshot);
});

it('sans aucun nouveau titre trouvé, échoue plutôt que de vider la pièce', async () => {
  const before = piece();
  const { deps } = setup({
    respond: () =>
      makeForgeResponse({ candidates: [makeCandidate({ artist: 'X', title: 'Introuvable' })] }),
    missing: new Set(['Introuvable']),
  });

  await expect(runReforge(before, deps)).rejects.toThrow(NoTracksFoundError);
});

it('tout trempé : rien à reforger, aucun appel', async () => {
  const before = piece();
  const allQuenched = { ...before, tracks: before.tracks.map((t) => ({ ...t, quenched: true })) };
  const { deps, forge } = setup();

  expect(await runReforge(allQuenched, deps)).toBe(allQuenched);
  expect(forge.forge).not.toHaveBeenCalled();
});

it('ne vérifie dans la bibliothèque que les nouveaux titres', async () => {
  const { deps, spotify } = setup({
    respond: (request, call) => freshCandidates(5, call * 10, request.avoid),
  });

  await runReforge(piece(), deps);

  const checked = spotify.libraryContains.mock.calls.flatMap(([uris]) => uris);
  expect(checked).toHaveLength(3);
  expect(checked.every((uri) => uri.includes('Neuf'))).toBe(true);
});
