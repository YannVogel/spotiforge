import { z } from 'zod';

import { SessionExpiredError, SessionUnavailableError } from '../../domain/session';
import { SpotifyError } from '../../domain/spotify';
import { createSpotifyGateway } from './gateway';
import { createSpotifyHttp, MAX_RATE_LIMIT_RETRIES, MAX_RETRY_AFTER_S } from './http';

type Reply = Response | Error;

function setup(...replies: Reply[]) {
  const fetch = jest.fn(async (_url: string, _init?: RequestInit) => {
    const reply = replies.shift();
    if (!reply) throw new Error('No more fake replies');
    if (reply instanceof Error) throw reply;
    return reply;
  });
  let token = 'token-1';
  const session = {
    getAccessToken: jest.fn(async () => token),
    refreshAfterUnauthorized: jest.fn(async (_rejected: string) => {
      token = 'token-2';
      return token;
    }),
  };
  const sleep = jest.fn(async (_ms: number) => {});
  const request = createSpotifyHttp({
    session,
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep,
  });
  const authHeaders = () =>
    fetch.mock.calls.map(([, init]) => (init?.headers as Record<string, string>).Authorization);
  return { request, fetch, session, sleep, authHeaders };
}

const schema = z.object({ id: z.string(), name: z.string().optional() });
const rateLimited = (retryAfter?: string) =>
  new Response(null, { status: 429, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('appelle l’API avec le jeton de la session et valide la réponse', async () => {
  const { request, fetch } = setup(Response.json({ id: 'a', name: 'Nom', extra: 'ignoré' }));

  expect(await request('/me', schema)).toEqual({ id: 'a', name: 'Nom' });
  expect(fetch).toHaveBeenCalledWith('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer token-1' },
  });
});

it('sur un 401, rafraîchit le jeton une fois et rejoue la requête', async () => {
  const { request, session, authHeaders } = setup(
    new Response(null, { status: 401 }),
    Response.json({ id: 'a' }),
  );

  expect(await request('/me', schema)).toEqual({ id: 'a' });
  expect(session.refreshAfterUnauthorized).toHaveBeenCalledWith('token-1');
  expect(authHeaders()).toEqual(['Bearer token-1', 'Bearer token-2']);
});

it('ne rejoue qu’une fois : un second 401 est une erreur « non autorisé »', async () => {
  const { request, session, fetch } = setup(
    new Response(null, { status: 401 }),
    new Response(null, { status: 401 }),
    Response.json({ id: 'a' }),
  );

  await expect(request('/me', schema)).rejects.toThrow(new SpotifyError('unauthorized', 401));
  expect(session.refreshAfterUnauthorized).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('sur un 429, attend la durée de Retry-After puis réessaie', async () => {
  const { request, sleep } = setup(rateLimited('2'), Response.json({ id: 'a' }));

  expect(await request('/me', schema)).toEqual({ id: 'a' });
  expect(sleep).toHaveBeenCalledWith(2000);
});

it('attend une seconde quand Retry-After manque', async () => {
  const { request, sleep } = setup(rateLimited(), Response.json({ id: 'a' }));

  await request('/me', schema);

  expect(sleep).toHaveBeenCalledWith(1000);
});

it('abandonne (quota) après plusieurs 429 de suite', async () => {
  const replies = Array.from({ length: MAX_RATE_LIMIT_RETRIES + 1 }, () => rateLimited('1'));
  const { request, sleep } = setup(...replies);

  await expect(request('/me', schema)).rejects.toThrow(new SpotifyError('rate_limited', 429));
  expect(sleep).toHaveBeenCalledTimes(MAX_RATE_LIMIT_RETRIES);
});

it('n’attend pas une durée déraisonnable', async () => {
  const { request, sleep } = setup(rateLimited(String(MAX_RETRY_AFTER_S + 1)));

  await expect(request('/me', schema)).rejects.toThrow(new SpotifyError('rate_limited', 429));
  expect(sleep).not.toHaveBeenCalled();
});

it('signale un compte hors des 5 autorisés (403)', async () => {
  const { request } = setup(new Response(null, { status: 403 }));

  await expect(request('/me', schema)).rejects.toThrow(new SpotifyError('forbidden', 403));
});

it.each([
  ['une erreur serveur', new Response(null, { status: 503 }), new SpotifyError('unavailable', 503)],
  ['une coupure réseau', new TypeError('Network request failed'), new SpotifyError('network')],
])('traduit %s en erreur du domaine', async (_case, reply, expected) => {
  const { request } = setup(reply);

  await expect(request('/me', schema)).rejects.toThrow(expected);
});

describe('champs absents', () => {
  it('ne casse pas quand un champ facultatif manque', async () => {
    const { request } = setup(Response.json({ id: 'a' }));

    expect(await request('/me', schema)).toEqual({ id: 'a' });
  });

  it('refuse proprement une réponse sans champ indispensable, sans en journaliser le contenu', async () => {
    const { request } = setup(Response.json({ name: 'Secret' }));

    await expect(request('/me?fields=secret', schema)).rejects.toThrow(
      new SpotifyError('unavailable', 200),
    );
    expect(console.warn).toHaveBeenCalledWith('Unexpected Spotify response for /me');
  });

  it('refuse un corps illisible', async () => {
    const { request } = setup(new Response('pas du json'));

    await expect(request('/me', schema)).rejects.toThrow(SpotifyError);
  });
});

describe('erreurs de session', () => {
  it('traduit une session expirée en « non autorisé » et une session injoignable en « réseau »', async () => {
    const expired = setup();
    expired.session.getAccessToken.mockRejectedValueOnce(new SessionExpiredError('expired'));
    await expect(expired.request('/me', schema)).rejects.toThrow(new SpotifyError('unauthorized'));

    const offline = setup(new Response(null, { status: 401 }));
    offline.session.refreshAfterUnauthorized.mockRejectedValueOnce(
      new SessionUnavailableError('offline'),
    );
    await expect(offline.request('/me', schema)).rejects.toThrow(new SpotifyError('network'));
  });
});

describe('SpotifyGateway', () => {
  it('lit le compte courant (GET /me), nom affiché absent toléré', async () => {
    const { request } = setup(Response.json({ id: 'fake-account', country: 'FR' }));

    expect(await createSpotifyGateway(request).getCurrentAccount()).toEqual({
      id: 'fake-account',
      displayName: null,
    });
  });
});
