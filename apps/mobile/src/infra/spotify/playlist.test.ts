import { SpotifyError } from '../../domain/spotify';
import { createSpotifyGateway, PLAYLIST_ITEMS_LIMIT } from './gateway';
import { createSpotifyHttp } from './http';

type Call = { url: URL; method: string; headers: Record<string, string>; body: unknown };

function setup(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetch = jest.fn(async (input: string, init?: RequestInit) => {
    const call = {
      url: new URL(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return reply(call);
  });
  const request = createSpotifyHttp({
    session: { getAccessToken: async () => 't', refreshAfterUnauthorized: async () => 't' },
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
  });
  return { gateway: createSpotifyGateway(request), calls };
}

const uris = (count: number) => Array.from({ length: count }, (_, i) => `spotify:track:t${i}`);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('crée une playlist privée avec son nom et sa description', async () => {
  const { gateway, calls } = setup(() =>
    Response.json({ id: 'fakePlaylist1', name: 'Route de nuit', public: false }, { status: 201 }),
  );

  expect(
    await gateway.createPlaylist({ name: 'Route de nuit', description: 'Une phrase.' }),
  ).toEqual({
    id: 'fakePlaylist1',
  });
  expect(calls[0]).toMatchObject({
    method: 'POST',
    body: { name: 'Route de nuit', description: 'Une phrase.', public: false },
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
  });
  expect(calls[0]?.url.pathname).toBe('/v1/me/playlists');
});

it('écarte un identifiant de playlist inattendu', async () => {
  const { gateway } = setup(() => Response.json({ id: '../../me' }, { status: 201 }));

  await expect(gateway.createPlaylist({ name: 'x', description: '' })).rejects.toThrow(
    new SpotifyError('unavailable', 201),
  );
});

it('remplace puis ajoute des titres, URI dans le corps', async () => {
  const { gateway, calls } = setup(() => Response.json({ snapshot_id: 'abc' }, { status: 201 }));

  await gateway.replacePlaylistItems('fakePlaylist1', uris(2));
  await gateway.addPlaylistItems('fakePlaylist1', uris(1));

  expect(calls.map((call) => [call.method, call.url.pathname, call.body])).toEqual([
    [
      'PUT',
      '/v1/playlists/fakePlaylist1/items',
      { uris: ['spotify:track:t0', 'spotify:track:t1'] },
    ],
    ['POST', '/v1/playlists/fakePlaylist1/items', { uris: ['spotify:track:t0'] }],
  ]);
});

it('change le nom et la description d’une playlist', async () => {
  const { gateway, calls } = setup(() => new Response(null, { status: 200 }));

  await gateway.updatePlaylistDetails('fakePlaylist1', { name: 'Nouveau', description: 'Neuve.' });

  expect(calls[0]).toMatchObject({
    method: 'PUT',
    body: { name: 'Nouveau', description: 'Neuve.' },
  });
  expect(calls[0]?.url.pathname).toBe('/v1/playlists/fakePlaylist1');
});

it('refuse plus de 100 URI par appel : le découpage revient au domaine', async () => {
  const { gateway, calls } = setup(() => Response.json({}));

  await expect(gateway.addPlaylistItems('p', uris(PLAYLIST_ITEMS_LIMIT + 1))).rejects.toThrow(
    RangeError,
  );
  expect(calls).toHaveLength(0);
});

it('remonte un 403 (compte hors des 5 autorisés)', async () => {
  const { gateway } = setup(() => new Response(null, { status: 403 }));

  await expect(gateway.createPlaylist({ name: 'x', description: '' })).rejects.toThrow(
    new SpotifyError('forbidden', 403),
  );
});
