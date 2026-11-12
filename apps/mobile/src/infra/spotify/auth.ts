import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseType,
  TokenError,
} from 'expo-auth-session';

import type { SpotifyTokens } from '../../domain/session';

export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/** Exactement les scopes de docs/SPOTIFY_API.md. */
export const SPOTIFY_SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
] as const;

export const REDIRECT_PATH = 'callback';
/** Durée de vie d'un jeton d'accès Spotify quand la réponse ne la donne pas. */
const DEFAULT_EXPIRES_IN_S = 3600;

export type SignInFailure = 'cancelled' | 'denied' | 'failed' | 'network';
export type SignInResult =
  { ok: true; tokens: SpotifyTokens } | { ok: false; reason: SignInFailure };

/**
 * URI de redirection : `spotiforge://callback` dans un build (y compris de développement),
 * `exp://<adresse>/--/callback` dans Expo Go. Chacune doit être déclarée dans le dashboard Spotify.
 */
export function spotifyRedirectUri(scheme: string): string {
  return makeRedirectUri({ scheme, path: REDIRECT_PATH });
}

type SignInConfig = { clientId: string; redirectScheme: string };

/**
 * Connexion par Authorization Code avec PKCE, sans secret dans l'app : la page Spotify s'ouvre,
 * la personne accepte, le code est échangé contre les jetons.
 */
export async function signInWithSpotify({
  clientId,
  redirectScheme,
}: SignInConfig): Promise<SignInResult> {
  const redirectUri = spotifyRedirectUri(redirectScheme);
  const request = new AuthRequest({
    clientId,
    scopes: [...SPOTIFY_SCOPES],
    redirectUri,
    responseType: ResponseType.Code,
    usePKCE: true,
  });

  let result: Awaited<ReturnType<AuthRequest['promptAsync']>>;
  try {
    result = await request.promptAsync(SPOTIFY_DISCOVERY);
  } catch (error) {
    console.error(
      'Spotify sign-in could not open',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, reason: 'failed' };
  }

  if (result.type === 'error') {
    return { ok: false, reason: result.params.error === 'access_denied' ? 'denied' : 'failed' };
  }
  if (result.type !== 'success') return { ok: false, reason: 'cancelled' };

  const code = result.params.code;
  if (!code || !request.codeVerifier) return { ok: false, reason: 'failed' };

  try {
    const token = await exchangeCodeAsync(
      { clientId, code, redirectUri, extraParams: { code_verifier: request.codeVerifier } },
      SPOTIFY_DISCOVERY,
    );
    if (!token.refreshToken) return { ok: false, reason: 'failed' };
    return {
      ok: true,
      tokens: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: (token.issuedAt + (token.expiresIn ?? DEFAULT_EXPIRES_IN_S)) * 1000,
        ...(token.scope && { scope: token.scope }),
      },
    };
  } catch (error) {
    // TokenError : Spotify a répondu, mais refuse l'échange ; sinon, le réseau a lâché.
    return { ok: false, reason: error instanceof TokenError ? 'failed' : 'network' };
  }
}
