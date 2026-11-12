import {
  type Account,
  NotSignedInError,
  SessionExpiredError,
  type SessionStorage,
  SessionUnavailableError,
  type SpotifyTokens,
  type StoredSession,
} from '../../domain/session';
import { setSession } from './session-store';

/** Le jeton d'accès est renouvelé s'il expire dans moins d'une minute. */
export const REFRESH_MARGIN_MS = 60_000;

type Dependencies = {
  storage: SessionStorage;
  refreshTokens: (
    current: SpotifyTokens,
  ) => Promise<{ ok: true; tokens: SpotifyTokens } | { ok: false; reason: 'revoked' | 'network' }>;
  fetchAccount: (
    accessToken: string,
  ) => Promise<
    | { ok: true; account: Account }
    | { ok: false; reason: 'unauthorized' | 'forbidden' | 'unavailable' }
  >;
  now: () => number;
};

export class SignInRejectedError extends Error {
  override name = 'SignInRejectedError';

  constructor(readonly reason: 'forbidden' | 'unavailable') {
    super(`Spotify sign-in rejected: ${reason}`);
  }
}

/**
 * Session Spotify : restauration au démarrage, jetons toujours valides (un seul rafraîchissement
 * à la fois), déconnexion. Ne touche jamais au brouillon : une session expirée renvoie à la
 * connexion, le brouillon reste où il est.
 */
export function createSessionManager({ storage, refreshTokens, fetchAccount, now }: Dependencies) {
  let current: StoredSession | null = null;
  let refreshing: Promise<SpotifyTokens> | null = null;

  async function end(reason: 'signedOut' | 'expired' | 'forbidden') {
    current = null;
    refreshing = null;
    await storage.clear();
    setSession({ status: 'signedOut', reason });
  }

  async function refresh(session: StoredSession): Promise<SpotifyTokens> {
    const result = await refreshTokens(session.tokens);
    if (!result.ok) {
      if (result.reason === 'revoked') {
        await end('expired');
        throw new SessionExpiredError('Spotify refused to refresh the session');
      }
      throw new SessionUnavailableError('Spotify could not be reached to refresh the session');
    }
    current = { ...session, tokens: result.tokens };
    await storage.save(current);
    return result.tokens;
  }

  /** Un seul rafraîchissement en vol : les appels concurrents attendent le même. */
  function refreshOnce(session: StoredSession): Promise<SpotifyTokens> {
    refreshing ??= refresh(session).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  function requireSession(): StoredSession {
    if (!current) throw new NotSignedInError('No Spotify session');
    return current;
  }

  return {
    /** Au démarrage : reprend la session gardée, sans réseau (l'historique reste lisible hors ligne). */
    async restore(): Promise<void> {
      setSession({ status: 'restoring' });
      current = await storage.load();
      setSession(
        current
          ? { status: 'signedIn', account: current.account }
          : { status: 'signedOut', reason: null },
      );
    },

    /** Après la connexion : lit le compte (`GET /me`) puis garde jetons et compte. */
    async signIn(tokens: SpotifyTokens): Promise<Account> {
      const result = await fetchAccount(tokens.accessToken);
      if (!result.ok) {
        const reason = result.reason === 'forbidden' ? 'forbidden' : 'unavailable';
        if (reason === 'forbidden') setSession({ status: 'signedOut', reason: 'forbidden' });
        throw new SignInRejectedError(reason);
      }
      current = { tokens, account: result.account };
      await storage.save(current);
      setSession({ status: 'signedIn', account: result.account });
      return result.account;
    },

    /** Jeton d'accès valide, renouvelé avant son expiration. */
    async getAccessToken(): Promise<string> {
      const session = requireSession();
      if (session.tokens.expiresAt - now() > REFRESH_MARGIN_MS) return session.tokens.accessToken;
      return (await refreshOnce(session)).accessToken;
    },

    /**
     * Après un 401 : renouvelle le jeton, sauf si un autre appel l'a déjà fait depuis l'envoi de
     * la requête refusée.
     */
    async refreshAfterUnauthorized(rejectedAccessToken: string): Promise<string> {
      const session = requireSession();
      if (session.tokens.accessToken !== rejectedAccessToken) return session.tokens.accessToken;
      return (await refreshOnce(session)).accessToken;
    },

    /** Supprime les jetons de l'appareil et oublie le compte. */
    async signOut(): Promise<void> {
      await end('signedOut');
    },
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
