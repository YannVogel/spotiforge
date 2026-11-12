import type { ResolutionCache } from '../../domain/resolution-cache';
import { parseRow, trackCacheRowSchema } from './rows';
import type { SqlDatabase } from './sql-database';

/** Cache de résolution adossé à la table `track_cache`. */
export function createResolutionCache(db: SqlDatabase): ResolutionCache {
  return {
    async get(key) {
      const row = await db.getFirstAsync<unknown>('SELECT * FROM track_cache WHERE query_key = ?', [
        key,
      ]);
      if (!row) return undefined;
      const cached = parseRow(trackCacheRowSchema, 'track_cache', row);
      if (cached.spotify_uri === null) return { track: null, resolvedAt: cached.resolved_at };
      return {
        track: {
          spotifyUri: cached.spotify_uri,
          title: cached.title ?? '',
          artists: cached.artists ?? [],
          year: cached.year ?? undefined,
          durationMs: cached.duration_ms ?? 0,
        },
        resolvedAt: cached.resolved_at,
      };
    },

    async set(key, { track, resolvedAt }) {
      await db.runAsync(
        `INSERT OR REPLACE INTO track_cache
           (query_key, spotify_uri, title, artists, year, duration_ms, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          key,
          track?.spotifyUri ?? null,
          track?.title ?? null,
          track ? JSON.stringify(track.artists) : null,
          track?.year ?? null,
          track?.durationMs ?? null,
          resolvedAt,
        ],
      );
    },
  };
}
