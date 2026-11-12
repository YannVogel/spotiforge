import type { PieceRecord } from '../../domain/history';
import { makePieceRecord } from '../../domain/test-fixtures';
import { migrate } from '../../infra/db/migrations';
import { createPieceRepository } from '../../infra/db/piece-repository';
import { createMemoryDatabase } from '../../infra/db/testing/node-sql-database';
import { useAnvilStore } from '../anvil/anvil-store';
import { startPiecePersistence } from './persistence';
import { checkSavedPiece, resumeOffer, resumePiece } from './resume';
import { useResumeStore } from './resume-store';

let stop: (() => void) | undefined;

beforeEach(() => {
  useAnvilStore.setState(useAnvilStore.getInitialState(), true);
  useResumeStore.setState(useResumeStore.getInitialState(), true);
});

afterEach(() => {
  stop?.();
});

async function realRepository() {
  const db = createMemoryDatabase();
  await migrate(db);
  return createPieceRepository(db);
}

function fakeRepository() {
  const saved: PieceRecord[] = [];
  return { saved, save: jest.fn(async (record: PieceRecord) => void saved.push(record)) };
}

it('enregistre la pièce dès la forge, puis à chaque trempe, reforge, édition et envoi', async () => {
  const repository = fakeRepository();
  const persistence = startPiecePersistence(repository);
  stop = persistence.stop;
  const record = makePieceRecord();
  const store = useAnvilStore.getState();

  store.open(record);
  await persistence.idle();
  store.toggleQuench(record.tracks[1]?.spotifyUri ?? '');
  await persistence.idle();
  store.setDetails('Nouveau titre', 'Nouvelle description');
  await persistence.idle();
  const edited = useAnvilStore.getState().record;
  if (edited) useAnvilStore.setState({ record: { ...edited, spotifyPlaylistId: 'fakePlaylist1' } });
  await persistence.idle();

  const saved = repository.saved;
  expect(saved).toHaveLength(4);
  expect(saved[1]?.tracks[1]?.quenched).toBe(true);
  expect(saved[2]?.title).toBe('Nouveau titre');
  expect(saved[3]?.spotifyPlaylistId).toBe('fakePlaylist1');
});

it('n’enregistre rien quand l’enclume se vide, ni après l’arrêt', async () => {
  const repository = fakeRepository();
  const persistence = startPiecePersistence(repository);
  useAnvilStore.getState().close();
  persistence.stop();
  useAnvilStore.getState().open(makePieceRecord());
  await persistence.idle();

  expect(repository.save).not.toHaveBeenCalled();
});

it('fermer l’app sur l’enclume puis la rouvrir permet de reprendre, trempe et refusés compris', async () => {
  const repository = await realRepository();
  const persistence = startPiecePersistence(repository);
  stop = persistence.stop;
  const record = makePieceRecord({ id: 'piece-nuit', title: 'Route de nuit' });
  useAnvilStore.getState().open(record);
  useAnvilStore.getState().toggleQuench(record.tracks[1]?.spotifyUri ?? '');
  await persistence.idle();
  const beforeClosing = useAnvilStore.getState().record;

  // « Fermeture » : la mémoire de l'app est perdue, la base reste.
  persistence.stop();
  useAnvilStore.setState(useAnvilStore.getInitialState(), true);
  useResumeStore.setState(useResumeStore.getInitialState(), true);

  await checkSavedPiece(repository, 'owner-a');
  expect(resumeOffer()).toEqual({ id: 'piece-nuit', title: 'Route de nuit' });
  const resumed = await resumePiece(repository, 'owner-a', 'piece-nuit');

  expect(resumed).toEqual(beforeClosing);
  expect(useAnvilStore.getState().record?.tracks[1]?.quenched).toBe(true);
  expect(useAnvilStore.getState().record?.rejected).toEqual(record.rejected);
});

it('une pièce envoyée garde son identifiant de playlist et n’est pas proposée à la reprise', async () => {
  const repository = await realRepository();
  await repository.save(
    makePieceRecord({
      id: 'piece-envoyee',
      spotifyPlaylistId: 'fakePlaylist1',
      sentAt: '2026-11-11T20:00:00.000Z',
    }),
  );

  await checkSavedPiece(repository, 'owner-a');

  expect(resumeOffer()).toBeNull();
  expect((await repository.findById('owner-a', 'piece-envoyee'))?.spotifyPlaylistId).toBe(
    'fakePlaylist1',
  );
});

it('propose la pièce sur l’enclume en priorité, et plus rien une fois écartée', async () => {
  useResumeStore.setState({
    saved: { ...makePieceRecord({ id: 'ancienne', title: 'Ancienne' }), trackCount: 3 },
  });
  useAnvilStore.getState().open(makePieceRecord({ id: 'courante', title: 'Courante' }));

  expect(resumeOffer()).toEqual({ id: 'courante', title: 'Courante' });
  useResumeStore.setState({ dismissed: true });
  expect(resumeOffer()).toBeNull();
});

it('ne cherche qu’une fois par lancement', async () => {
  const repository = { list: jest.fn(async () => []), findById: jest.fn() };

  await checkSavedPiece(repository, 'owner-a');
  await checkSavedPiece(repository, 'owner-a');

  expect(repository.list).toHaveBeenCalledTimes(1);
});
