import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bearerToken, createAuthenticator, IDENTITY_TTL_MS, type IdentityCache } from './auth';

const TOKEN = 'fake-access-token-123';
const ALLOWED = new Set(['fake-account-allowed']);

function spotifyReplies(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  }
  return fetch;
}

const me = (id: string) => Response.json({ id, display_name: 'Nom inventé', type: 'user' });
const request = (authorization?: string) =>
  new Request('https://worker.example.test/forge', {
    headers: authorization ? { Authorization: authorization } : {},
  });

let clock = 1_000_000;
let cache: IdentityCache;
let logs: ReturnType<typeof vi.spyOn>[];

function setup(fetch: typeof globalThis.fetch) {
  return createAuthenticator({ fetch, now: () => clock, cache });
}

beforeEach(() => {
  clock = 1_000_000;
  cache = new Map();
  logs = (['error', 'warn', 'log', 'info'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
});

afterEach(() => {
  // Aucun log ne doit contenir de jeton ni d'identifiant de compte.
  const written = JSON.stringify(logs.flatMap((spy) => spy.mock.calls));
  expect(written).not.toContain(TOKEN);
  expect(written).not.toContain('fake-account');
  vi.restoreAllMocks();
});

describe('bearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc ', 'abc'],
    ['Bearer', null],
    ['Basic abc', null],
    ['Bearer a b', null],
  ])('%s → %s', (header, expected) => {
    expect(bearerToken(request(header))).toBe(expected);
  });
});

describe('authenticate', () => {
  it('laisse passer un compte autorisé, après vérification auprès de Spotify', async () => {
    const fetch = spotifyReplies(me('fake-account-allowed'));

    const result = await setup(fetch)(request(`Bearer ${TOKEN}`), ALLOWED);

    expect(result).toEqual({ ok: true, accountId: 'fake-account-allowed' });
    expect(fetch).toHaveBeenCalledWith('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it('refuse (403) un jeton valide d’un compte hors liste', async () => {
    const result = await setup(spotifyReplies(me('fake-account-other')))(
      request(`Bearer ${TOKEN}`),
      ALLOWED,
    );

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' });
  });

  it('refuse (401) une requête sans jeton, sans appeler Spotify', async () => {
    const fetch = spotifyReplies();

    expect(await setup(fetch)(request(), ALLOWED)).toEqual({
      ok: false,
      status: 401,
      error: 'unauthorized',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuse (401) un jeton que Spotify ne reconnaît pas', async () => {
    const fetch = spotifyReplies(Response.json({ error: { status: 401 } }, { status: 401 }));

    expect((await setup(fetch)(request(`Bearer ${TOKEN}`), ALLOWED)).ok).toBe(false);
    expect(
      await setup(spotifyReplies(new Response(null, { status: 401 })))(
        request(`Bearer ${TOKEN}`),
        ALLOWED,
      ),
    ).toMatchObject({ status: 401 });
  });

  it('refuse (403) un compte que Spotify ne compte pas parmi les utilisateurs de l’app', async () => {
    const fetch = spotifyReplies(new Response(null, { status: 403 }));

    expect(await setup(fetch)(request(`Bearer ${TOKEN}`), ALLOWED)).toMatchObject({ status: 403 });
  });

  it.each([
    ['une erreur serveur', new Response(null, { status: 503 })],
    ['une limite de débit', new Response(null, { status: 429 })],
    ['une réponse sans identifiant', Response.json({ display_name: 'x' })],
    ['un corps illisible', new Response('pas du json')],
    ['une coupure réseau', new Error('network down')],
  ])('répond 502 quand Spotify renvoie %s', async (_case, reply) => {
    const result = await setup(spotifyReplies(reply))(request(`Bearer ${TOKEN}`), ALLOWED);

    expect(result).toEqual({ ok: false, status: 502, error: 'spotify_unavailable' });
  });

  describe('cache', () => {
    it('réutilise une identité vérifiée sans rappeler Spotify, indexée par une empreinte', async () => {
      const fetch = spotifyReplies(me('fake-account-allowed'));
      const authenticate = setup(fetch);

      await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);
      clock += IDENTITY_TTL_MS - 1;
      const second = await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);

      expect(second).toEqual({ ok: true, accountId: 'fake-account-allowed' });
      expect(fetch).toHaveBeenCalledTimes(1);
      const [key] = [...cache.keys()];
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain(TOKEN);
    });

    it('revérifie auprès de Spotify une fois le délai passé', async () => {
      const fetch = spotifyReplies(me('fake-account-allowed'), me('fake-account-allowed'));
      const authenticate = setup(fetch);

      await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);
      clock += IDENTITY_TTL_MS;
      await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('applique tout de suite un retrait de la liste autorisée', async () => {
      const authenticate = setup(spotifyReplies(me('fake-account-allowed')));
      await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);

      expect(await authenticate(request(`Bearer ${TOKEN}`), new Set())).toMatchObject({
        status: 403,
      });
    });

    it('ne garde pas les refus de Spotify', async () => {
      const fetch = spotifyReplies(new Response(null, { status: 401 }), me('fake-account-allowed'));
      const authenticate = setup(fetch);

      await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);
      const retry = await authenticate(request(`Bearer ${TOKEN}`), ALLOWED);

      expect(retry.ok).toBe(true);
      expect(cache.size).toBe(1);
    });

    it('oublie les identités expirées et reste borné', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => me('fake-account-allowed'));
      const authenticate = setup(fetch);

      for (let i = 0; i < 150; i++) {
        await authenticate(request(`Bearer token-${i}`), ALLOWED);
      }
      expect(cache.size).toBeLessThanOrEqual(100);

      clock += IDENTITY_TTL_MS;
      await authenticate(request('Bearer token-new'), ALLOWED);
      expect(cache.size).toBe(1);
    });
  });
});
