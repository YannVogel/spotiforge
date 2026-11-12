import type { Taste } from '@spotiforge/shared';

import { artistNames } from './normalize';
import { SpotifyError, type SpotifyGateway } from './spotify';
import { listenedArtistKeys } from './taste';
import type { ResolvedTrack } from './track';

/** URI au plus par appel à `GET /me/library/contains` (docs/SPOTIFY_API.md). */
export const LIBRARY_BATCH_SIZE = 40;

type Marked = Pick<ResolvedTrack, 'spotifyUri' | 'artist' | 'known'>;

type Dependencies = {
  libraryContains: SpotifyGateway['libraryContains'];
  /** Résumé des écoutes, s'il est disponible. */
  taste: Taste | null;
};

/**
 * Présence dans la bibliothèque, par URI ; `undefined` quand Spotify n'a pas pu répondre. Lots de
 * 40, l'un après l'autre : au plus `ceil(n / 40)` appels, et aucun après une panne.
 */
async function libraryPresence(
  uris: readonly string[],
  libraryContains: Dependencies['libraryContains'],
): Promise<Map<string, boolean>> {
  const presence = new Map<string, boolean>();
  for (let start = 0; start < uris.length; start += LIBRARY_BATCH_SIZE) {
    const batch = uris.slice(start, start + LIBRARY_BATCH_SIZE);
    let saved: boolean[];
    try {
      saved = await libraryContains(batch);
    } catch (error) {
      if (error instanceof SpotifyError && error.kind !== 'unauthorized') break;
      throw error;
    }
    batch.forEach((uri, index) => presence.set(uri, saved[index] === true));
  }
  return presence;
}

/**
 * Marque chaque titre « connu » ou « découverte » : connu s'il est dans la bibliothèque de la
 * personne ou si l'un de ses artistes figure dans ses écoutes. Sans réponse de la bibliothèque, on
 * garde l'estimation du LLM (`familiar`, déjà portée par `known`) pour les titres d'artistes non
 * écoutés. Seuls les titres dont l'artiste n'est pas déjà écouté sont vérifiés.
 */
export async function markKnownTracks<T extends Marked>(
  tracks: readonly T[],
  { libraryContains, taste }: Dependencies,
): Promise<T[]> {
  const listened = taste ? listenedArtistKeys(taste) : new Set<string>();
  const byListenedArtist = (track: T) =>
    artistNames(track.artist).some((name) => listened.has(name));

  const toCheck = [
    ...new Set(tracks.filter((track) => !byListenedArtist(track)).map((t) => t.spotifyUri)),
  ];
  const presence = await libraryPresence(toCheck, libraryContains);

  return tracks.map((track) => {
    if (byListenedArtist(track)) return { ...track, known: true };
    const saved = presence.get(track.spotifyUri);
    return { ...track, known: saved ?? track.known };
  });
}
