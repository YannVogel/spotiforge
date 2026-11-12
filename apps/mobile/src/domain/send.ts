import type { PieceRecord } from './history';
import type { SpotifyGateway } from './spotify';

/** URI au plus par appel à `POST` ou `PUT /playlists/{id}/items` (docs/SPOTIFY_API.md). */
export const PLAYLIST_BATCH_SIZE = 100;

type Dependencies = {
  spotify: Pick<SpotifyGateway, 'createPlaylist' | 'replacePlaylistItems' | 'addPlaylistItems'>;
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
 * une panne ne crée ni seconde playlist ni doublon : le remplacement repart de zéro. Le nom et la
 * description d'une playlist déjà créée ne sont pas touchés ici (rafraîchissement, #45).
 */
export async function sendPiece(record: PieceRecord, deps: Dependencies): Promise<PieceRecord> {
  let playlistId = record.spotifyPlaylistId;
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
  await deps.spotify.replacePlaylistItems(playlistId, first);
  for (const batch of rest) await deps.spotify.addPlaylistItems(playlistId, batch);

  const at = deps.now().toISOString();
  return { ...record, spotifyPlaylistId: playlistId, sentAt: at, updatedAt: at };
}
