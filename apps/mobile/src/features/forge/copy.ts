import type { ForgeFailure } from './failure';
import type { ForgeProgress } from './forge-run';

// Textes de la forge en cours et de ses échecs : ce qui se passe, puis quoi faire (docs/DESIGN.md).
export const FORGE_COPY = {
  forging: 'Forge en cours…',
  cancel: 'Annuler la forge',
  retry: 'Réessayer la forge',
} as const;

export function progressText(progress: ForgeProgress): string {
  switch (progress.stage) {
    case 'listening':
      return 'Lecture de tes écoutes…';
    case 'forging':
      return 'Le métal chauffe : l’IA compose ta playlist…';
    case 'resolving':
      return `Vérification sur Spotify : ${progress.done} / ${progress.total} titres`;
    case 'marking':
      return 'Tri des titres connus et des découvertes…';
  }
}

export function failureText(failure: ForgeFailure): string {
  switch (failure.kind) {
    case 'signed_out':
      return 'Ta session Spotify n’est plus active. Reconnecte-toi : ton minerai et tes réglages sont gardés.';
    case 'forbidden':
      return 'Ce compte Spotify n’est pas autorisé à utiliser Spotiforge. Demande à la personne qui gère l’app de t’ajouter.';
    case 'rate_limited':
      return failure.retryAfterMinutes === undefined
        ? 'La forge refroidit : trop de forges d’affilée. Réessaie dans quelques minutes.'
        : `La forge refroidit : trop de forges d’affilée. Réessaie dans ${failure.retryAfterMinutes} min.`;
    case 'spotify_busy':
      return 'Spotify limite les demandes pour l’instant. Réessaie dans une minute.';
    case 'unavailable':
      return 'La forge n’a pas abouti : le service ne répond pas. Réessaie dans un instant, ton minerai est gardé.';
    case 'offline':
      return 'Pas de connexion internet. Vérifie ton réseau, puis réessaie.';
    case 'no_tracks':
      return 'Aucun titre proposé n’a été trouvé sur Spotify. Retouche un peu le minerai, puis réessaie.';
    case 'bug':
      return 'La forge a échoué à cause d’un problème de l’app. Réessaie ; si ça revient, signale-le.';
  }
}
