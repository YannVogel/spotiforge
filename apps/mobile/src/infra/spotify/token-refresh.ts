import { refreshAsync, TokenError } from 'expo-auth-session';

import type { SpotifyTokens } from '../../domain/session';
import { SPOTIFY_DISCOVERY } from './auth';

const DEFAULT_EXPIRES_IN_S = 3600;

export type RefreshResult =
  { ok: true; tokens: SpotifyTokens } | { ok: false; reason: 'revoked' | 'network' };

/** Demande un nouveau jeton d'accès. Spotify peut renouveler aussi le jeton de rafraîchissement. */
export async function refreshSpotifyTokens(
  clientId: string,
  current: SpotifyTokens,
): Promise<RefreshResult> {
  try {
    const token = await refreshAsync(
      { clientId, refreshToken: current.refreshToken },
      SPOTIFY_DISCOVERY,
    );
    return {
      ok: true,
      tokens: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? current.refreshToken,
        expiresAt: (token.issuedAt + (token.expiresIn ?? DEFAULT_EXPIRES_IN_S)) * 1000,
        ...((token.scope ?? current.scope) && { scope: token.scope ?? current.scope }),
      },
    };
  } catch (error) {
    // TokenError : Spotify a répondu et refuse (jeton révoqué ou expiré) ; sinon, réseau.
    return { ok: false, reason: error instanceof TokenError ? 'revoked' : 'network' };
  }
}
