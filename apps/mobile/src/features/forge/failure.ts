import { ForgeError } from '../../domain/forge';
import { NotSignedInError, SessionExpiredError } from '../../domain/session';
import { SpotifyError } from '../../domain/spotify';
import { NoTracksFoundError } from './forge-run';

/** Ce que l'écran doit dire d'un échec de forge (tableau « Erreurs » de docs/GENERATION.md). */
export type ForgeFailure =
  | { kind: 'signed_out' }
  | { kind: 'forbidden' }
  | { kind: 'rate_limited'; retryAfterMinutes?: number }
  | { kind: 'spotify_busy' }
  | { kind: 'unavailable' }
  | { kind: 'offline' }
  | { kind: 'no_tracks' }
  | { kind: 'bug' };

/** Traduit n'importe quelle erreur de la forge en échec affichable ; l'inconnu devient un bug. */
export function forgeFailureOf(error: unknown): ForgeFailure {
  if (error instanceof ForgeError) {
    switch (error.kind) {
      case 'unauthorized':
        return { kind: 'signed_out' };
      case 'forbidden':
        return { kind: 'forbidden' };
      case 'rate_limited':
        return error.retryAfterS === undefined
          ? { kind: 'rate_limited' }
          : {
              kind: 'rate_limited',
              retryAfterMinutes: Math.max(1, Math.ceil(error.retryAfterS / 60)),
            };
      case 'unavailable':
        return { kind: 'unavailable' };
      case 'network':
        return { kind: 'offline' };
      case 'invalid_request':
        return { kind: 'bug' };
    }
  }
  if (error instanceof SpotifyError) {
    switch (error.kind) {
      case 'unauthorized':
        return { kind: 'signed_out' };
      case 'forbidden':
        return { kind: 'forbidden' };
      case 'rate_limited':
        return { kind: 'spotify_busy' };
      case 'network':
        return { kind: 'offline' };
      case 'unavailable':
        return { kind: 'unavailable' };
    }
  }
  if (error instanceof NotSignedInError || error instanceof SessionExpiredError) {
    return { kind: 'signed_out' };
  }
  if (error instanceof NoTracksFoundError) return { kind: 'no_tracks' };
  return { kind: 'bug' };
}
