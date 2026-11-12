import type { PieceRecord, PieceRepository, PieceSummary } from '../../domain/history';
import {
  parseRow,
  pieceRowSchema,
  pieceSummaryRowSchema,
  pieceTrackRowSchema,
  rejectedTrackRowSchema,
} from './rows';
import type { SqlDatabase } from './sql-database';

type PieceRow = ReturnType<typeof pieceRowSchema.parse>;

function toPieceFields(row: PieceRow) {
  return {
    id: row.id,
    ownerSpotifyId: row.owner_spotify_id,
    title: row.title,
    description: row.description,
    prompt: row.prompt,
    settings: row.settings,
    spotifyPlaylistId: row.spotify_playlist_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
  };
}

export function createPieceRepository(db: SqlDatabase): PieceRepository {
  async function assertOwnedOrNew(ownerSpotifyId: string, id: string) {
    const existing = await db.getFirstAsync<{ owner_spotify_id: string }>(
      'SELECT owner_spotify_id FROM pieces WHERE id = ?',
      [id],
    );
    if (existing && existing.owner_spotify_id !== ownerSpotifyId) {
      throw new Error('Piece belongs to another account');
    }
  }

  return {
    async save(piece: PieceRecord) {
      await db.withTransactionAsync(async () => {
        await assertOwnedOrNew(piece.ownerSpotifyId, piece.id);
        await db.runAsync(
          `INSERT INTO pieces (id, owner_spotify_id, title, description, prompt, settings,
             spotify_playlist_id, created_at, updated_at, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             title = excluded.title, description = excluded.description, prompt = excluded.prompt,
             settings = excluded.settings, spotify_playlist_id = excluded.spotify_playlist_id,
             updated_at = excluded.updated_at, sent_at = excluded.sent_at`,
          [
            piece.id,
            piece.ownerSpotifyId,
            piece.title,
            piece.description,
            piece.prompt,
            JSON.stringify(piece.settings),
            piece.spotifyPlaylistId,
            piece.createdAt,
            piece.updatedAt,
            piece.sentAt,
          ],
        );
        await db.runAsync('DELETE FROM piece_tracks WHERE piece_id = ?', [piece.id]);
        await db.runAsync('DELETE FROM rejected_tracks WHERE piece_id = ?', [piece.id]);
        for (const [position, track] of piece.tracks.entries()) {
          await db.runAsync(
            `INSERT INTO piece_tracks (piece_id, position, spotify_uri, title, artist, year,
               duration_ms, reason, slot, known, quenched)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              piece.id,
              position,
              track.spotifyUri,
              track.title,
              track.artist,
              track.year,
              track.durationMs,
              track.reason,
              track.slot,
              track.known ? 1 : 0,
              track.quenched ? 1 : 0,
            ],
          );
        }
        for (const [position, track] of piece.rejected.entries()) {
          await db.runAsync(
            `INSERT INTO rejected_tracks (piece_id, position, spotify_uri, artist, title)
             VALUES (?, ?, ?, ?, ?)`,
            [piece.id, position, track.spotifyUri, track.artist, track.title],
          );
        }
      });
    },

    async findById(ownerSpotifyId, id) {
      const row = await db.getFirstAsync<unknown>(
        'SELECT * FROM pieces WHERE id = ? AND owner_spotify_id = ?',
        [id, ownerSpotifyId],
      );
      if (!row) return null;
      const piece = parseRow(pieceRowSchema, 'pieces', row);
      const trackRows = await db.getAllAsync<unknown>(
        'SELECT * FROM piece_tracks WHERE piece_id = ? ORDER BY position',
        [id],
      );
      const rejectedRows = await db.getAllAsync<unknown>(
        'SELECT * FROM rejected_tracks WHERE piece_id = ? ORDER BY position',
        [id],
      );
      return {
        ...toPieceFields(piece),
        tracks: trackRows.map((trackRow) => {
          const track = parseRow(pieceTrackRowSchema, 'piece_tracks', trackRow);
          return {
            spotifyUri: track.spotify_uri,
            title: track.title,
            artist: track.artist,
            year: track.year,
            durationMs: track.duration_ms,
            reason: track.reason,
            slot: track.slot,
            known: track.known,
            quenched: track.quenched,
          };
        }),
        rejected: rejectedRows.map((rejectedRow) => {
          const track = parseRow(rejectedTrackRowSchema, 'rejected_tracks', rejectedRow);
          return { spotifyUri: track.spotify_uri, artist: track.artist, title: track.title };
        }),
      };
    },

    async list(ownerSpotifyId): Promise<PieceSummary[]> {
      const rows = await db.getAllAsync<unknown>(
        `SELECT pieces.*,
           (SELECT COUNT(*) FROM piece_tracks WHERE piece_id = pieces.id) AS track_count
         FROM pieces WHERE owner_spotify_id = ? ORDER BY created_at DESC, id`,
        [ownerSpotifyId],
      );
      return rows.map((row) => {
        const piece = parseRow(pieceSummaryRowSchema, 'pieces', row);
        return { ...toPieceFields(piece), trackCount: piece.track_count };
      });
    },

    async delete(ownerSpotifyId, id) {
      // Les titres et les refus partent avec la pièce (ON DELETE CASCADE).
      await db.runAsync('DELETE FROM pieces WHERE id = ? AND owner_spotify_id = ?', [
        id,
        ownerSpotifyId,
      ]);
    },
  };
}
