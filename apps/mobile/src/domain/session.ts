/** Jetons Spotify d'une personne connectée. Ne quittent jamais le stockage sécurisé et la mémoire. */
export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  /** Expiration du jeton d'accès, en millisecondes depuis l'époque Unix. */
  expiresAt: number;
  scope?: string;
};

/** Le compte Spotify connecté (`GET /me`). */
export type Account = {
  id: string;
  displayName: string | null;
};

/** Ce qui survit à un redémarrage : jetons et compte, pour retrouver l'historique hors ligne. */
export type StoredSession = {
  tokens: SpotifyTokens;
  account: Account;
};

export interface SessionStorage {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

/** Plus personne n'est connecté. */
export class NotSignedInError extends Error {
  override name = 'NotSignedInError';
}

/** Spotify a refusé le rafraîchissement : il faut se reconnecter. */
export class SessionExpiredError extends Error {
  override name = 'SessionExpiredError';
}

/** Spotify est injoignable : la session reste ouverte, l'action peut être retentée. */
export class SessionUnavailableError extends Error {
  override name = 'SessionUnavailableError';
}
