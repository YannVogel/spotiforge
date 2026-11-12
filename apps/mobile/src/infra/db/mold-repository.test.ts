import { makeMold } from './fixtures';
import { migrate } from './migrations';
import { createMoldRepository } from './mold-repository';
import type { SqlDatabase } from './sql-database';
import { createMemoryDatabase } from './testing/node-sql-database';

let db: SqlDatabase;
let repository: ReturnType<typeof createMoldRepository>;

beforeEach(async () => {
  db = createMemoryDatabase();
  await migrate(db);
  repository = createMoldRepository(db);
});

it('crée puis relit un moule à l’identique', async () => {
  await repository.save(makeMold());

  expect(await repository.findById('owner-a', 'mold-1')).toEqual(makeMold());
});

it('met à jour un moule enregistré à nouveau', async () => {
  await repository.save(makeMold());

  await repository.save(makeMold({ prompt: 'Un dimanche matin pluvieux' }));

  expect((await repository.findById('owner-a', 'mold-1'))?.prompt).toBe(
    'Un dimanche matin pluvieux',
  );
});

it('liste les moules d’un compte, les plus récents d’abord', async () => {
  await repository.save(makeMold({ id: 'a', createdAt: '2026-11-01T00:00:00.000Z' }));
  await repository.save(makeMold({ id: 'b', createdAt: '2026-11-05T00:00:00.000Z' }));
  await repository.save(makeMold({ id: 'c', ownerSpotifyId: 'owner-b' }));

  expect((await repository.list('owner-a')).map((mold) => mold.id)).toEqual(['b', 'a']);
});

it('renomme et supprime un moule', async () => {
  await repository.save(makeMold());

  await repository.rename('owner-a', 'mold-1', 'Matin lent');
  expect((await repository.findById('owner-a', 'mold-1'))?.name).toBe('Matin lent');

  await repository.delete('owner-a', 'mold-1');
  expect(await repository.findById('owner-a', 'mold-1')).toBeNull();
});

it('ne touche jamais au moule d’un autre compte', async () => {
  await repository.save(makeMold());

  await repository.rename('owner-b', 'mold-1', 'Pirate');
  await repository.delete('owner-b', 'mold-1');
  await expect(repository.save(makeMold({ ownerSpotifyId: 'owner-b' }))).rejects.toThrow(
    'another account',
  );

  expect(await repository.findById('owner-b', 'mold-1')).toBeNull();
  expect(await repository.findById('owner-a', 'mold-1')).toEqual(makeMold());
});

it('refuse un moule aux réglages corrompus', async () => {
  await repository.save(makeMold());
  await db.runAsync("UPDATE molds SET settings = 'pas du json'", []);

  await expect(repository.list('owner-a')).rejects.toThrow('Corrupted row in molds (settings)');
});
