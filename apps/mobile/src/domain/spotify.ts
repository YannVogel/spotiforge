import type { CatalogTrack } from './match';
import type { Account } from './session';
import type { ListenedArtist } from './taste';

export type SpotifyErrorKind =
  /** Jeton refusé même après rafraîchissement : il faut se reconnecter. */
  | 'unauthorized'
  /** Compte absent des 5 utilisateurs autorisés de l'app (mode développement). */
  | 'forbidden'
  /** Quota dépassé, attente trop longue ou répétée. */
  | 'rate_limited'
  | 'network'
  /** Spotify en erreur ou réponse inexploitable. */
  | 'unavailable';

export class SpotifyError extends Error {
  override name = 'SpotifyError';

  constructor(
    readonly kind: SpotifyErrorKind,
    readonly status?: number,
  ) {
    super(`Spotify request failed: ${kind}${status ? ` (${status})` : ''}`);
  }
}

/** Ce dont le domaine a besoin de Spotify. S'enrichit endpoint par endpoint, au fil des issues. */
export interface SpotifyGateway {
  getCurrentAccount(): Promise<Account>;
  /** Recherche de titres (10 résultats au plus), dans l'ordre de pertinence de Spotify. */
  searchTracks(query: { artist: string; title: string }): Promise<CatalogTrack[]>;
  /** Artistes les plus écoutés (environ six derniers mois), du plus au moins écouté. */
  getTopArtists(): Promise<ListenedArtist[]>;
  /** Artistes des écoutes récentes, de la plus récente à la plus ancienne. */
  getRecentlyPlayedArtists(): Promise<string[]>;
  /** Pour chaque URI (40 au plus), présente ou non dans la bibliothèque de la personne. */
  libraryContains(uris: readonly string[]): Promise<boolean[]>;
  /** Crée une playlist privée, vide, sur le compte. */
  createPlaylist(details: PlaylistDetails): Promise<{ id: string }>;
  /** Change le nom et la description d'une playlist du compte. */
  updatePlaylistDetails(playlistId: string, details: PlaylistDetails): Promise<void>;
  /** Remplace tous les titres d'une playlist (100 URI au plus). */
  replacePlaylistItems(playlistId: string, uris: readonly string[]): Promise<void>;
  /** Ajoute des titres à la fin d'une playlist (100 URI au plus). */
  addPlaylistItems(playlistId: string, uris: readonly string[]): Promise<void>;
}

export type PlaylistDetails = { name: string; description: string };
