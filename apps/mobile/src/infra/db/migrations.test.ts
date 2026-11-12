import { migrate, MIGRATIONS, SCHEMA_VERSION } from './migrations';
import type { SqlDatabase } from './sql-database';
import { createMemoryDatabase } from './testing/node-sql-database';

async function schemaOf(db: SqlDatabase) {
  return db.getAllAsync<{ type: string; name: string; sql: string }>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
    [],
  );
}

async function versionOf(db: SqlDatabase) {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))
    ?.user_version;
}

it('crée les cinq tables sur une base neuve et note la version', async () => {
  const db = createMemoryDatabase();

  await migrate(db);

  const tables = (await schemaOf(db)).filter((entry) => entry.type === 'table').map((t) => t.name);
  expect(tables).toEqual(['molds', 'piece_tracks', 'pieces', 'rejected_tracks', 'track_cache']);
  expect(await versionOf(db)).toBe(SCHEMA_VERSION);
});

it('aboutit au même schéma depuis chaque version intermédiaire que depuis une base neuve', async () => {
  const fresh = createMemoryDatabase();
  await migrate(fresh);
  const expected = await schemaOf(fresh);

  for (let start = 0; start <= MIGRATIONS.length; start++) {
    const db = createMemoryDatabase();
    for (const migration of MIGRATIONS.slice(0, start)) await db.execAsync(migration);
    await db.execAsync(`PRAGMA user_version = ${start}`);

    await migrate(db);

    expect(await schemaOf(db)).toEqual(expected);
    expect(await versionOf(db)).toBe(SCHEMA_VERSION);
  }
});

it('ne rejoue rien et garde les données d’une base à jour', async () => {
  const db = createMemoryDatabase();
  await migrate(db);
  await db.runAsync(
    "INSERT INTO track_cache (query_key, resolved_at) VALUES ('k', '2026-11-12T00:00:00Z')",
    [],
  );

  await migrate(db);

  expect(await db.getAllAsync('SELECT query_key FROM track_cache', [])).toEqual([
    { query_key: 'k' },
  ]);
});

it('refuse une base plus récente que l’app', async () => {
  const db = createMemoryDatabase();
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);

  await expect(migrate(db)).rejects.toThrow('newer than this app');
});
