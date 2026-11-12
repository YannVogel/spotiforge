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
}
