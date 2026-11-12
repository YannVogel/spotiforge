import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';

import { ForgeCancelledError, ForgeError } from '../../domain/forge';
import { SessionExpiredError, SessionUnavailableError } from '../../domain/session';
import { createForgeGateway } from './worker-client';

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
  const gateway = createForgeGateway({
    workerUrl: 'https://forge.example.test',
    session,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  return { gateway, fetch, session };
}

const request = makeForgeRequest();
const response = makeForgeResponse();

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('envoie la demande au Worker avec le jeton Spotify et renvoie la réponse validée', async () => {
  const { gateway, fetch } = setup(Response.json({ ...response, extra: 'retiré' }));

  expect(await gateway.forge(request)).toEqual(response);
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(url).toBe('https://forge.example.test/forge');
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({
    Authorization: 'Bearer token-1',
    'Content-Type': 'application/json',
  });
  expect(JSON.parse(String(init?.body))).toEqual(request);
});

it('sur un 401, rafraîchit le jeton une fois et rejoue', async () => {
  const { gateway, session, fetch } = setup(
    new Response(null, { status: 401 }),
    Response.json(response),
  );

  expect(await gateway.forge(request)).toEqual(response);
  expect(session.refreshAfterUnauthorized).toHaveBeenCalledWith('token-1');
  expect((fetch.mock.calls[1]?.[1]?.headers as Record<string, string>).Authorization).toBe(
    'Bearer token-2',
  );
});

it.each([
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [400, 'invalid_request'],
  [502, 'unavailable'],
  [500, 'unavailable'],
] as const)('traduit un %i en erreur « %s »', async (status, kind) => {
  const replies = status === 401 ? [401, 401] : [status];
  const { gateway } = setup(...replies.map((s) => Response.json({ error: 'x' }, { status: s })));

  await expect(gateway.forge(request)).rejects.toThrow(new ForgeError(kind));
});

it('sur un 429, transmet l’attente conseillée', async () => {
  const { gateway } = setup(
    Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '1200' } }),
  );

  const error = await gateway.forge(request).catch((e: unknown) => e);
  expect(error).toEqual(new ForgeError('rate_limited'));
  expect((error as ForgeError).retryAfterS).toBe(1200);
});

it('écarte une réponse hors contrat', async () => {
  const { gateway } = setup(Response.json({ title: 'Sans candidats' }));

  await expect(gateway.forge(request)).rejects.toThrow(new ForgeError('unavailable'));
});

it('hors ligne : erreur réseau', async () => {
  const { gateway } = setup(new TypeError('Network request failed'));

  await expect(gateway.forge(request)).rejects.toThrow(new ForgeError('network'));
});

it('annulée : ni erreur réseau ni message', async () => {
  const controller = new AbortController();
  controller.abort();
  const { gateway } = setup(new Error('Aborted'));

  await expect(gateway.forge(request, controller.signal)).rejects.toThrow(ForgeCancelledError);
});

it('session expirée ou injoignable : erreurs de forge correspondantes', async () => {
  const expired = setup();
  expired.session.getAccessToken.mockRejectedValueOnce(new SessionExpiredError('expired'));
  await expect(expired.gateway.forge(request)).rejects.toThrow(new ForgeError('unauthorized'));

  const offline = setup(new Response(null, { status: 401 }));
  offline.session.refreshAfterUnauthorized.mockRejectedValueOnce(
    new SessionUnavailableError('offline'),
  );
  await expect(offline.gateway.forge(request)).rejects.toThrow(new ForgeError('network'));
});
