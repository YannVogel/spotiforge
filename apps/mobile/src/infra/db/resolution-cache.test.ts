import { migrate } from './migrations';
import { createResolutionCache } from './resolution-cache';
import type { SqlDatabase } from './sql-database';
import { createMemoryDatabase } from './testing/node-sql-database';

let db: SqlDatabase;
let cache: ReturnType<typeof createResolutionCache>;

const nightcall = {
  spotifyUri: 'spotify:track:fake-nightcall',
  title: 'Nightcall',
  artists: ['Kavinsky'],
  year: 2010,
  durationMs: 258_000,
};

beforeEach(async () => {
  db = createMemoryDatabase();
  await migrate(db);
  cache = createResolutionCache(db);
});

it('ne connaît pas une clé jamais résolue', async () => {
  expect(await cache.get('kavinsky|nightcall')).toBeUndefined();
});

it('garde un titre trouvé', async () => {
  await cache.set('kavinsky|nightcall', { track: nightcall, resolvedAt: '2026-11-12T00:00:00Z' });

  expect(await cache.get('kavinsky|nightcall')).toEqual({
    track: nightcall,
    resolvedAt: '2026-11-12T00:00:00Z',
  });
});

it('garde aussi un titre introuvable, pour ne pas le rechercher à nouveau', async () => {
  await cache.set('inconnu|titre', { track: null, resolvedAt: '2026-11-12T00:00:00Z' });

  expect(await cache.get('inconnu|titre')).toEqual({
    track: null,
    resolvedAt: '2026-11-12T00:00:00Z',
  });
});

it('remplace une résolution plus ancienne', async () => {
  await cache.set('kavinsky|nightcall', { track: null, resolvedAt: '2026-11-01T00:00:00Z' });
  await cache.set('kavinsky|nightcall', { track: nightcall, resolvedAt: '2026-11-12T00:00:00Z' });

  expect((await cache.get('kavinsky|nightcall'))?.track).toEqual(nightcall);
});

it('accepte un titre sans année connue', async () => {
  const { year: _year, ...withoutYear } = nightcall;
  await cache.set('k', { track: withoutYear, resolvedAt: '2026-11-12T00:00:00Z' });

  expect((await cache.get('k'))?.track).toEqual(withoutYear);
});

it('refuse une liste d’artistes corrompue', async () => {
  await cache.set('kavinsky|nightcall', { track: nightcall, resolvedAt: '2026-11-12T00:00:00Z' });
  await db.runAsync("UPDATE track_cache SET artists = '{oups'", []);

  await expect(cache.get('kavinsky|nightcall')).rejects.toThrow(
    'Corrupted row in track_cache (artists)',
  );
});
