import { signInWithSpotify, SPOTIFY_SCOPES } from './auth';

const mockPrompt = jest.fn();
const mockExchange = jest.fn();
const mockRedirect = jest.fn(
  (options: { scheme: string; path: string }) => `${options.scheme}://${options.path}`,
);
const mockRequests: { config: Record<string, unknown> }[] = [];

jest.mock('expo-auth-session', () => {
  class TokenError extends Error {}
  class AuthRequest {
    codeVerifier: string | undefined = 'fake-verifier';
    constructor(readonly config: Record<string, unknown>) {
      mockRequests.push(this);
    }
    promptAsync(discovery: unknown) {
      return mockPrompt(discovery);
    }
  }
  return {
    AuthRequest,
    TokenError,
    ResponseType: { Code: 'code' },
    exchangeCodeAsync: (...args: unknown[]) => mockExchange(...args),
    makeRedirectUri: (options: { scheme: string; path: string }) => mockRedirect(options),
  };
});

const config = { clientId: 'fake-client-id', redirectScheme: 'spotiforge' };
const { TokenError } = jest.requireMock<{ TokenError: new (message: string) => Error }>(
  'expo-auth-session',
);

beforeEach(() => {
  mockRequests.length = 0;
  mockPrompt.mockReset();
  mockExchange.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('se connecte en PKCE et renvoie jeton d’accès, jeton de rafraîchissement et expiration', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'fake-code' } });
  mockExchange.mockResolvedValue({
    accessToken: 'fake-access',
    refreshToken: 'fake-refresh',
    expiresIn: 3600,
    issuedAt: 1_000_000,
    scope: SPOTIFY_SCOPES.join(' '),
  });

  const result = await signInWithSpotify(config);

  expect(result).toEqual({
    ok: true,
    tokens: {
      accessToken: 'fake-access',
      refreshToken: 'fake-refresh',
      expiresAt: (1_000_000 + 3600) * 1000,
      scope: SPOTIFY_SCOPES.join(' '),
    },
  });
  expect(mockExchange).toHaveBeenCalledWith(
    {
      clientId: 'fake-client-id',
      code: 'fake-code',
      redirectUri: 'spotiforge://callback',
      extraParams: { code_verifier: 'fake-verifier' },
    },
    {
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    },
  );
});

it('demande exactement les scopes de la doc, en PKCE, sur l’URI de redirection de l’app', async () => {
  mockPrompt.mockResolvedValue({ type: 'cancel' });

  await signInWithSpotify(config);

  expect(mockRedirect).toHaveBeenCalledWith({ scheme: 'spotiforge', path: 'callback' });
  expect(mockRequests[0]?.config).toEqual({
    clientId: 'fake-client-id',
    scopes: [
      'playlist-modify-private',
      'playlist-modify-public',
      'user-top-read',
      'user-read-recently-played',
      'user-library-read',
    ],
    redirectUri: 'spotiforge://callback',
    responseType: 'code',
    usePKCE: true,
  });
});

it.each(['cancel', 'dismiss', 'locked'])('traite « %s » comme une annulation', async (type) => {
  mockPrompt.mockResolvedValue({ type });

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'cancelled' });
  expect(mockExchange).not.toHaveBeenCalled();
});

it('distingue le refus de la personne', async () => {
  mockPrompt.mockResolvedValue({ type: 'error', params: { error: 'access_denied' } });

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'denied' });
});

it('échoue sur une autre erreur d’autorisation', async () => {
  mockPrompt.mockResolvedValue({ type: 'error', params: { error: 'invalid_client' } });

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'failed' });
});

it('échoue si la page de connexion ne s’ouvre pas', async () => {
  mockPrompt.mockRejectedValue(new Error('no browser'));

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'failed' });
});

it('signale une erreur réseau pendant l’échange du code', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'fake-code' } });
  mockExchange.mockRejectedValue(new TypeError('Network request failed'));

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'network' });
});

it('échoue si Spotify refuse l’échange du code', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'fake-code' } });
  mockExchange.mockRejectedValue(new TokenError('invalid_grant'));

  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'failed' });
});

it('échoue sans jeton de rafraîchissement, et sans code', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'fake-code' } });
  mockExchange.mockResolvedValue({ accessToken: 'fake-access', issuedAt: 1 });
  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'failed' });

  mockPrompt.mockResolvedValue({ type: 'success', params: {} });
  expect(await signInWithSpotify(config)).toEqual({ ok: false, reason: 'failed' });
});

it('compte une heure de validité si Spotify ne donne pas l’expiration', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'fake-code' } });
  mockExchange.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', issuedAt: 10 });

  const result = await signInWithSpotify(config);

  expect(result.ok && result.tokens.expiresAt).toBe((10 + 3600) * 1000);
});
