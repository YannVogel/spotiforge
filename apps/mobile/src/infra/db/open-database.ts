import { openDatabaseAsync } from 'expo-sqlite';

import { migrate } from './migrations';
import type { SqlDatabase } from './sql-database';

const DATABASE_NAME = 'spotiforge.db';

/** Ouvre la base locale, active les clés étrangères et applique les migrations. */
export async function openAppDatabase(): Promise<SqlDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}
