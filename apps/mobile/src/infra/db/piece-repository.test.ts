import { makePieceTrack } from '../../domain/test-fixtures';
import { makePieceRecord } from './fixtures';
import { migrate } from './migrations';
import { createPieceRepository } from './piece-repository';
import { CorruptedRowError } from './rows';
import type { SqlDatabase } from './sql-database';
import { createMemoryDatabase } from './testing/node-sql-database';

let db: SqlDatabase;
let repository: ReturnType<typeof createPieceRepository>;

beforeEach(async () => {
  db = createMemoryDatabase();
  await migrate(db);
  repository = createPieceRepository(db);
});

it('enregistre puis relit une pièce à l’identique', async () => {
  const piece = makePieceRecord();

  await repository.save(piece);

  expect(await repository.findById('owner-a', 'piece-1')).toEqual(piece);
});

it('met à jour une pièce : titres, refus et dates d’envoi, sans changer la date de création', async () => {
  const piece = makePieceRecord();
  await repository.save(piece);
  const updated = makePieceRecord({
    title: 'Route de nuit (bis)',
    tracks: piece.tracks.slice(0, 1),
    rejected: [],
    spotifyPlaylistId: 'fake-playlist',
    sentAt: '2026-11-11T08:00:00.000Z',
    updatedAt: '2026-11-11T08:00:00.000Z',
    createdAt: '2030-01-01T00:00:00.000Z',
  });

  await repository.save(updated);

  expect(await repository.findById('owner-a', 'piece-1')).toEqual({
    ...updated,
    createdAt: piece.createdAt,
  });
});

it('liste les pièces d’un compte, les plus récentes d’abord, avec leur nombre de titres', async () => {
  await repository.save(makePieceRecord({ id: 'old', createdAt: '2026-11-01T00:00:00.000Z' }));
  await repository.save(
    makePieceRecord({ id: 'new', createdAt: '2026-11-09T00:00:00.000Z', tracks: [] }),
  );
  await repository.save(makePieceRecord({ id: 'other', ownerSpotifyId: 'owner-b' }));

  const summaries = await repository.list('owner-a');

  expect(summaries.map((summary) => [summary.id, summary.trackCount])).toEqual([
    ['new', 0],
    ['old', 3],
  ]);
  expect(summaries[0]).not.toHaveProperty('tracks');
});

it('supprime une pièce avec ses titres et ses refus', async () => {
  await repository.save(makePieceRecord());

  await repository.delete('owner-a', 'piece-1');

  expect(await repository.findById('owner-a', 'piece-1')).toBeNull();
  expect(await db.getAllAsync('SELECT * FROM piece_tracks', [])).toEqual([]);
  expect(await db.getAllAsync('SELECT * FROM rejected_tracks', [])).toEqual([]);
});

describe('cloisonnement par compte', () => {
  it('ne lit, ne supprime ni n’écrase la pièce d’un autre compte', async () => {
    await repository.save(makePieceRecord());

    expect(await repository.findById('owner-b', 'piece-1')).toBeNull();
    await repository.delete('owner-b', 'piece-1');
    await expect(
      repository.save(makePieceRecord({ ownerSpotifyId: 'owner-b', title: 'Pirate' })),
    ).rejects.toThrow('another account');

    expect((await repository.findById('owner-a', 'piece-1'))?.title).toBe('Route de nuit');
  });
});

describe('lignes corrompues', () => {
  it('refuse des réglages illisibles sans recopier leur contenu', async () => {
    await repository.save(makePieceRecord());
    await db.runAsync('UPDATE pieces SET settings = \'{"discovery": 900}\'', []);

    const read = repository.findById('owner-a', 'piece-1');

    await expect(read).rejects.toThrow(CorruptedRowError);
    await expect(read).rejects.toThrow('Corrupted row in pieces (settings)');
  });

  it('refuse un état de trempe qui n’est pas un booléen', async () => {
    await repository.save(makePieceRecord());
    await db.execAsync('PRAGMA ignore_check_constraints = ON');
    await db.runAsync('UPDATE piece_tracks SET quenched = 7 WHERE position = 0', []);

    await expect(repository.findById('owner-a', 'piece-1')).rejects.toThrow(
      'Corrupted row in piece_tracks (quenched)',
    );
  });

  it('annule tout l’enregistrement si une écriture échoue', async () => {
    const piece = makePieceRecord();
    await repository.save(piece);
    // Une année NaN devient NULL pour SQLite et viole la contrainte NOT NULL au 2e titre.
    const broken = makePieceRecord({
      title: 'Ne doit pas rester',
      tracks: [makePieceTrack(1), makePieceTrack(2, { year: Number.NaN })],
    });

    await expect(repository.save(broken)).rejects.toThrow();

    expect(await repository.findById('owner-a', 'piece-1')).toEqual(piece);
  });
});
