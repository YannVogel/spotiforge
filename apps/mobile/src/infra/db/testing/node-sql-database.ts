/// <reference types="node" />
// Tests seulement : une base SQLite en mémoire (node:sqlite) derrière l'interface SqlDatabase.
import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlValue } from '../sql-database';

export function createMemoryDatabase(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const rows = <T>(source: string, params: SqlValue[]) =>
    db
      .prepare(source)
      .all(...params)
      .map((row) => ({ ...row }) as T);

  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params) {
      return { changes: Number(db.prepare(source).run(...params).changes) };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params)[0] ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params);
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
