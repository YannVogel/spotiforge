import { migrate } from './migrations';
import type { SqlDatabase } from './sql-database';
import { createTasteCache } from './taste-cache';
import { createMemoryDatabase } from './testing/node-sql-database';

let db: SqlDatabase;
let cache: ReturnType<typeof createTasteCache>;

const taste = {
  topArtists: ['Kavinsky', 'M83'],
  recentArtists: ['Desire'],
  genres: ['synthwave'],
};

beforeEach(async () => {
  db = createMemoryDatabase();
  await migrate(db);
  cache = createTasteCache(db);
});

it('ne connaît pas un compte jamais résumé', async () => {
  expect(await cache.get('owner-a')).toBeUndefined();
});

it('garde le résumé et sa date, par compte', async () => {
  await cache.set('owner-a', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });

  expect(await cache.get('owner-a')).toEqual({ taste, fetchedAt: '2026-11-12T08:00:00.000Z' });
  expect(await cache.get('owner-b')).toBeUndefined();
});

it('remplace un résumé plus ancien', async () => {
  await cache.set('owner-a', { taste, fetchedAt: '2026-11-10T08:00:00.000Z' });
  const newer = { ...taste, recentArtists: ['Perturbator'] };
  await cache.set('owner-a', { taste: newer, fetchedAt: '2026-11-12T08:00:00.000Z' });

  expect(await cache.get('owner-a')).toEqual({
    taste: newer,
    fetchedAt: '2026-11-12T08:00:00.000Z',
  });
});

it('oublie le résumé d’un compte sans toucher aux autres', async () => {
  await cache.set('owner-a', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });
  await cache.set('owner-b', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });

  await cache.clear('owner-a');

  expect(await cache.get('owner-a')).toBeUndefined();
  expect(await cache.get('owner-b')).toBeDefined();
});

it('refuse un résumé corrompu', async () => {
  await cache.set('owner-a', { taste, fetchedAt: '2026-11-12T08:00:00.000Z' });
  await db.runAsync('UPDATE taste_cache SET taste = \'{"topArtists": 3}\'', []);

  await expect(cache.get('owner-a')).rejects.toThrow('Corrupted row in taste_cache (taste)');
});
