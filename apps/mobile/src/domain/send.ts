import type { PieceRecord } from './history';
import { SpotifyError, type SpotifyGateway } from './spotify';

/** URI au plus par appel à `POST` ou `PUT /playlists/{id}/items` (docs/SPOTIFY_API.md). */
export const PLAYLIST_BATCH_SIZE = 100;

/** La playlist de la pièce n'existe plus sur Spotify (supprimée depuis l'app Spotify, par exemple). */
export class PlaylistMissingError extends Error {
  override name = 'PlaylistMissingError';
}

type Dependencies = {
  spotify: Pick<
    SpotifyGateway,
    'createPlaylist' | 'replacePlaylistItems' | 'addPlaylistItems' | 'updatePlaylistDetails'
  >;
  now: () => Date;
  /**
   * Appelé dès que la playlist existe, avant l'ajout des titres : si la suite échoue, la reprise
   * réutilise cette playlist au lieu d'en créer une seconde.
   */
  onPlaylistCreated?: (playlistId: string) => void;
};

function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** La pièce est sur Spotify et n'a pas changé depuis son envoi. */
export function isSentAndUnchanged(record: PieceRecord): boolean {
  return record.sentAt !== null && record.updatedAt <= record.sentAt;
}

/**
 * Écrit la pièce sur Spotify : crée la playlist (privée) si elle n'existe pas encore, puis
 * **remplace** ses titres par le premier lot et ajoute les suivants, dans l'ordre. Rejouer après
 * une panne ne crée ni seconde playlist ni doublon : le remplacement repart de zéro.
 *
 * Une pièce déjà envoyée est **rafraîchie** dans sa playlist : mêmes titres trempés aux mêmes
 * places, nouveaux titres ailleurs, puis nom et description mis à jour. Si cette playlist n'existe
 * plus, `PlaylistMissingError` : c'est à la personne de décider de la recréer.
 */
export async function sendPiece(record: PieceRecord, deps: Dependencies): Promise<PieceRecord> {
  const existing = record.spotifyPlaylistId;
  let playlistId = existing;
  if (!playlistId) {
    ({ id: playlistId } = await deps.spotify.createPlaylist({
      name: record.title,
      description: record.description,
    }));
    deps.onPlaylistCreated?.(playlistId);
  }

  const [first = [], ...rest] = batches(
    record.tracks.map((track) => track.spotifyUri),
    PLAYLIST_BATCH_SIZE,
  );
  try {
    await deps.spotify.replacePlaylistItems(playlistId, first);
  } catch (error) {
    const gone = error instanceof SpotifyError && error.status === 404;
    if (existing && gone) throw new PlaylistMissingError('The piece playlist no longer exists');
    throw error;
  }
  for (const batch of rest) await deps.spotify.addPlaylistItems(playlistId, batch);
  if (existing && record.sentAt !== null) {
    await deps.spotify.updatePlaylistDetails(playlistId, {
      name: record.title,
      description: record.description,
    });
  }

  const at = deps.now().toISOString();
  return { ...record, spotifyPlaylistId: playlistId, sentAt: at, updatedAt: at };
}

/** Recréer la playlist d'une pièce dont la playlist a disparu : la prochaine écriture en créera une. */
export function forgetPlaylist(record: PieceRecord): PieceRecord {
  return { ...record, spotifyPlaylistId: null, sentAt: null };
}
