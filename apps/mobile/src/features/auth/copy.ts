import type { SessionState } from '../session/session-store';
import type { SignInFailure } from './sign-in-store';

// Textes de l'écran de connexion. Les actions qui touchent au compte disent ce qu'elles font
// (docs/DESIGN.md) : « Se connecter avec Spotify ».
export const SIGN_IN_COPY = {
  hero: 'Allume\nla forge',
  intro:
    'Spotiforge compose des playlists sur mesure et les range sur ton compte Spotify. Connecte-toi pour commencer.',
  signIn: 'Se connecter avec Spotify',
  signingIn: 'Connexion…',
  signOut: 'Se déconnecter',
  signOutOf: (name: string) => `Se déconnecter (${name})`,
} as const;

/** Pourquoi la personne est revenue à l'écran de connexion, s'il y a lieu. */
export function signedOutText(reason: Extract<SessionState, { status: 'signedOut' }>['reason']) {
  switch (reason) {
    case 'expired':
      return 'Ta session Spotify a expiré. Reconnecte-toi : ton minerai et tes réglages sont gardés.';
    case 'forbidden':
      return signInFailureText('forbidden');
    default:
      return null;
  }
}

export function signInFailureText(failure: SignInFailure): string | null {
  switch (failure) {
    case 'cancelled':
      return null;
    case 'denied':
      return 'Tu as refusé l’accès à ton compte. Spotiforge en a besoin pour lire tes écoutes et créer tes playlists : réessaie et accepte.';
    case 'network':
      return 'Spotify ne répond pas. Vérifie ta connexion internet, puis réessaie.';
    case 'forbidden':
      return 'Ce compte Spotify n’est pas autorisé à utiliser Spotiforge : l’app est limitée à cinq comptes. Demande à la personne qui la gère de t’ajouter, puis reconnecte-toi.';
    case 'failed':
      return 'La connexion à Spotify n’a pas abouti. Réessaie dans un instant.';
  }
}
