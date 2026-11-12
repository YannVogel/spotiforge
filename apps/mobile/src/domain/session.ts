/** Jetons Spotify d'une personne connectée. Ne quittent jamais le stockage sécurisé et la mémoire. */
export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  /** Expiration du jeton d'accès, en millisecondes depuis l'époque Unix. */
  expiresAt: number;
  scope?: string;
};
