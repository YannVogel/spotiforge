import { ForgeError } from '../../domain/forge';
import { NotSignedInError, SessionExpiredError } from '../../domain/session';
import { SpotifyError } from '../../domain/spotify';

export type SendFailure =
  'signed_out' | 'forbidden' | 'offline' | 'spotify_busy' | 'unavailable' | 'bug';

/** Traduit une erreur d'envoi en échec affichable ; l'inconnu devient un bug. */
export function sendFailureOf(error: unknown): SendFailure {
  if (error instanceof SpotifyError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'signed_out';
      case 'forbidden':
        return 'forbidden';
      case 'network':
        return 'offline';
      case 'rate_limited':
        return 'spotify_busy';
      case 'unavailable':
        return 'unavailable';
    }
  }
  if (
    error instanceof NotSignedInError ||
    error instanceof SessionExpiredError ||
    (error instanceof ForgeError && error.kind === 'unauthorized')
  ) {
    return 'signed_out';
  }
  return 'bug';
}

/** Ce qui se passe, puis quoi faire (docs/DESIGN.md). Une reprise ne crée jamais de doublon. */
export function sendFailureText(failure: SendFailure): string {
  switch (failure) {
    case 'signed_out':
      return 'Ta session Spotify n’est plus active. Reconnecte-toi, puis réessaie l’envoi : ta pièce est gardée.';
    case 'forbidden':
      return 'Spotify refuse d’écrire sur ce compte : il n’est sans doute pas parmi les cinq comptes autorisés de l’app. Demande à la personne qui gère l’app de t’ajouter.';
    case 'offline':
      return 'Pas de connexion : la playlist n’est pas encore complète sur Spotify. Réessaie quand le réseau revient, sans risque de doublon.';
    case 'spotify_busy':
      return 'Spotify limite les demandes pour l’instant. Réessaie dans une minute, sans risque de doublon.';
    case 'unavailable':
      return 'Spotify n’a pas pu enregistrer la playlist. Réessaie dans un instant, sans risque de doublon.';
    case 'bug':
      return 'L’envoi a échoué à cause d’un problème de l’app. Réessaie ; si ça revient, signale-le.';
  }
}
