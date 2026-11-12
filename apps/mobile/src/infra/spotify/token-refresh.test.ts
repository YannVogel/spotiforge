import { refreshSpotifyTokens } from './token-refresh';

const mockRefresh = jest.fn();

jest.mock('expo-auth-session', () => {
  class TokenError extends Error {}
  return {
    TokenError,
    refreshAsync: (...args: unknown[]) => mockRefresh(...args),
    // Utilisés par ./auth (importé pour SPOTIFY_DISCOVERY).
    AuthRequest: class {},
    ResponseType: { Code: 'code' },
    exchangeCodeAsync: jest.fn(),
    makeRedirectUri: jest.fn(),
  };
});

const { TokenError } = jest.requireMock<{ TokenError: new (message: string) => Error }>(
  'expo-auth-session',
);
const current = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 0,
  scope: 'user-top-read',
};

beforeEach(() => mockRefresh.mockReset());

it('renouvelle le jeton d’accès et garde le jeton de rafraîchissement renouvelé', async () => {
  mockRefresh.mockResolvedValue({
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    expiresIn: 3600,
    issuedAt: 100,
  });

  expect(await refreshSpotifyTokens('fake-client', current)).toEqual({
    ok: true,
    tokens: {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: 3_700_000,
      scope: 'user-top-read',
    },
  });
  expect(mockRefresh).toHaveBeenCalledWith(
    { clientId: 'fake-client', refreshToken: 'old-refresh' },
    expect.objectContaining({ tokenEndpoint: 'https://accounts.spotify.com/api/token' }),
  );
});

it('garde l’ancien jeton de rafraîchissement si Spotify n’en donne pas', async () => {
  mockRefresh.mockResolvedValue({ accessToken: 'new-access', issuedAt: 100 });

  const result = await refreshSpotifyTokens('fake-client', current);

  expect(result.ok && result.tokens.refreshToken).toBe('old-refresh');
});

it('distingue un jeton révoqué d’une coupure réseau', async () => {
  mockRefresh.mockRejectedValueOnce(new TokenError('invalid_grant'));
  expect(await refreshSpotifyTokens('fake-client', current)).toEqual({
    ok: false,
    reason: 'revoked',
  });

  mockRefresh.mockRejectedValueOnce(new TypeError('Network request failed'));
  expect(await refreshSpotifyTokens('fake-client', current)).toEqual({
    ok: false,
    reason: 'network',
  });
});
