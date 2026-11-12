import type { CatalogTrack } from './match';
import type { Account } from './session';

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
}
