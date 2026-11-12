import { makeMold, makePieceRecord } from '../../domain/test-fixtures';
import { migrate } from '../../infra/db/migrations';
import { createMoldRepository } from '../../infra/db/mold-repository';
import { createPieceRepository } from '../../infra/db/piece-repository';
import { createTasteCache } from '../../infra/db/taste-cache';
import { createMemoryDatabase } from '../../infra/db/testing/node-sql-database';
import { useAnvilStore } from '../anvil/anvil-store';
import { useDraftStore } from '../draft/draft-store';
import { checkSavedPiece, resumeOffer } from '../pieces/resume';
import { useResumeStore } from '../pieces/resume-store';
import { setAlloyAvailability, useAlloyStore } from '../taste/taste-store';
import { forgetAccountState, signOutAndForget, watchAccountChanges } from './account-scope';
import { setSession } from './session-store';

const account = (id: string) => ({ id, displayName: null });
const taste = { topArtists: ['Kavinsky'], recentArtists: [], genres: [] };

async function database() {
  const db = createMemoryDatabase();
  await migrate(db);
  return {
    pieces: createPieceRepository(db),
    molds: createMoldRepository(db),
    tasteCache: createTasteCache(db),
  };
}

function fillMemory(ownerSpotifyId: string) {
  useDraftStore.getState().setPrompt('Minerai de A');
  useAnvilStore.getState().open(makePieceRecord({ ownerSpotifyId }));
  setAlloyAvailability('unavailable');
  useResumeStore.setState({ checked: true, dismissed: true });
}

beforeEach(() => {
  forgetAccountState();
  setSession({ status: 'signedOut', reason: null });
});

it('deux comptes sur la même base ne voient que leurs pièces, moules et écoutes', async () => {
  const { pieces, molds, tasteCache } = await database();
  await pieces.save(makePieceRecord({ id: 'piece-a', ownerSpotifyId: 'owner-a' }));
  await pieces.save(makePieceRecord({ id: 'piece-b', ownerSpotifyId: 'owner-b' }));
  await molds.save(makeMold({ id: 'mold-a', ownerSpotifyId: 'owner-a' }));
  await tasteCache.set('owner-a', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });

  expect((await pieces.list('owner-b')).map((piece) => piece.id)).toEqual(['piece-b']);
  expect(await pieces.findById('owner-b', 'piece-a')).toBeNull();
  expect(await molds.list('owner-b')).toEqual([]);
  expect(await tasteCache.get('owner-b')).toBeUndefined();
});

it('la reprise ne propose jamais la pièce d’un autre compte', async () => {
  const { pieces } = await database();
  await pieces.save(makePieceRecord({ id: 'piece-a', ownerSpotifyId: 'owner-a' }));

  await checkSavedPiece(pieces, 'owner-b');

  expect(resumeOffer()).toBeNull();
});

it('se déconnecter vide la mémoire et le résumé des écoutes, et garde l’historique', async () => {
  const { pieces, tasteCache } = await database();
  await pieces.save(makePieceRecord({ id: 'piece-a', ownerSpotifyId: 'owner-a' }));
  await tasteCache.set('owner-a', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });
  setSession({ status: 'signedIn', account: account('owner-a') });
  fillMemory('owner-a');
  const session = {
    signOut: jest.fn(async () => setSession({ status: 'signedOut', reason: 'signedOut' })),
  };

  await signOutAndForget({ session, tasteCache });

  expect(session.signOut).toHaveBeenCalledTimes(1);
  expect(useDraftStore.getState().draft.prompt).toBe('');
  expect(useAnvilStore.getState().record).toBeNull();
  expect(useAlloyStore.getState().availability).toBe('unknown');
  expect(useResumeStore.getState()).toMatchObject({ checked: false, dismissed: false });
  expect(await tasteCache.get('owner-a')).toBeUndefined();
  // Masqué, pas supprimé : le même compte retrouvera son historique.
  expect(await pieces.findById('owner-a', 'piece-a')).not.toBeNull();
});

it('un autre compte qui se connecte ne voit rien de la mémoire du précédent', () => {
  setSession({ status: 'signedIn', account: account('owner-a') });
  const stop = watchAccountChanges();
  fillMemory('owner-a');

  setSession({ status: 'signedOut', reason: 'expired' });
  setSession({ status: 'signedIn', account: account('owner-b') });
  stop();

  expect(useDraftStore.getState().draft.prompt).toBe('');
  expect(useAnvilStore.getState().record).toBeNull();
});

it('une session expirée puis reprise par le même compte garde le brouillon', () => {
  setSession({ status: 'signedIn', account: account('owner-a') });
  const stop = watchAccountChanges();
  fillMemory('owner-a');

  setSession({ status: 'signedOut', reason: 'expired' });
  setSession({ status: 'signedIn', account: account('owner-a') });
  stop();

  expect(useDraftStore.getState().draft.prompt).toBe('Minerai de A');
  expect(useAnvilStore.getState().record).not.toBeNull();
});
