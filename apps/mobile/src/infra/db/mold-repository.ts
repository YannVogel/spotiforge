import type { Mold, MoldRepository } from '../../domain/history';
import { moldRowSchema, parseRow } from './rows';
import type { SqlDatabase } from './sql-database';

function toMold(row: unknown): Mold {
  const mold = parseRow(moldRowSchema, 'molds', row);
  return {
    id: mold.id,
    ownerSpotifyId: mold.owner_spotify_id,
    name: mold.name,
    prompt: mold.prompt,
    settings: mold.settings,
    createdAt: mold.created_at,
  };
}

export function createMoldRepository(db: SqlDatabase): MoldRepository {
  return {
    async save(mold) {
      const result = await db.runAsync(
        `INSERT INTO molds (id, owner_spotify_id, name, prompt, settings, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, prompt = excluded.prompt, settings = excluded.settings
         WHERE molds.owner_spotify_id = excluded.owner_spotify_id`,
        [
          mold.id,
          mold.ownerSpotifyId,
          mold.name,
          mold.prompt,
          JSON.stringify(mold.settings),
          mold.createdAt,
        ],
      );
      if (result.changes === 0) throw new Error('Mold belongs to another account');
    },

    async findById(ownerSpotifyId, id) {
      const row = await db.getFirstAsync<unknown>(
        'SELECT * FROM molds WHERE id = ? AND owner_spotify_id = ?',
        [id, ownerSpotifyId],
      );
      return row ? toMold(row) : null;
    },

    async list(ownerSpotifyId) {
      const rows = await db.getAllAsync<unknown>(
        'SELECT * FROM molds WHERE owner_spotify_id = ? ORDER BY created_at DESC, id',
        [ownerSpotifyId],
      );
      return rows.map(toMold);
    },

    async rename(ownerSpotifyId, id, name) {
      await db.runAsync('UPDATE molds SET name = ? WHERE id = ? AND owner_spotify_id = ?', [
        name,
        id,
        ownerSpotifyId,
      ]);
    },

    async delete(ownerSpotifyId, id) {
      await db.runAsync('DELETE FROM molds WHERE id = ? AND owner_spotify_id = ?', [
        id,
        ownerSpotifyId,
      ]);
    },
  };
}
