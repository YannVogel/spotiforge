import type { TasteCache } from '../../domain/taste';
import { parseRow, tasteCacheRowSchema } from './rows';
import type { SqlDatabase } from './sql-database';

/** Résumé des écoutes adossé à la table `taste_cache`, une ligne par compte. */
export function createTasteCache(db: SqlDatabase): TasteCache & {
  /** Oublie le résumé d'un compte (déconnexion). */
  clear(ownerSpotifyId: string): Promise<void>;
} {
  return {
    async get(ownerSpotifyId) {
      const row = await db.getFirstAsync<unknown>(
        'SELECT taste, fetched_at FROM taste_cache WHERE owner_spotify_id = ?',
        [ownerSpotifyId],
      );
      if (!row) return undefined;
      const cached = parseRow(tasteCacheRowSchema, 'taste_cache', row);
      return { taste: cached.taste, fetchedAt: cached.fetched_at };
    },

    async set(ownerSpotifyId, { taste, fetchedAt }) {
      await db.runAsync(
        'INSERT OR REPLACE INTO taste_cache (owner_spotify_id, taste, fetched_at) VALUES (?, ?, ?)',
        [ownerSpotifyId, JSON.stringify(taste), fetchedAt],
      );
    },

    async clear(ownerSpotifyId) {
      await db.runAsync('DELETE FROM taste_cache WHERE owner_spotify_id = ?', [ownerSpotifyId]);
    },
  };
}
