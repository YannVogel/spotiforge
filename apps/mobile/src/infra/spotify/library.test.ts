import { SpotifyError } from '../../domain/spotify';
import { createSpotifyGateway, LIBRARY_CONTAINS_LIMIT } from './gateway';
import { createSpotifyHttp } from './http';

function setup(reply: () => Response) {
  const urls: URL[] = [];
  const fetch = jest.fn(async (input: string) => {
    urls.push(new URL(input));
    return reply();
  });
  const request = createSpotifyHttp({
    session: { getAccessToken: async () => 't', refreshAfterUnauthorized: async () => 't' },
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
  });
  return { gateway: createSpotifyGateway(request), urls, fetch };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('demande la présence des titres par leurs URI, séparées par des virgules', async () => {
  const { gateway, urls } = setup(() => Response.json([true, false]));

  expect(await gateway.libraryContains(['spotify:track:a', 'spotify:track:b'])).toEqual([
    true,
    false,
  ]);
  expect(urls[0]?.pathname).toBe('/v1/me/library/contains');
  expect(urls[0]?.searchParams.get('uris')).toBe('spotify:track:a,spotify:track:b');
});

it('n’appelle pas Spotify pour une liste vide', async () => {
  const { gateway, fetch } = setup(() => Response.json([]));

  expect(await gateway.libraryContains([])).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

it('refuse plus de 40 URI : le découpage en lots revient au domaine', async () => {
  const { gateway } = setup(() => Response.json([]));
  const uris = Array.from({ length: LIBRARY_CONTAINS_LIMIT + 1 }, (_, i) => `spotify:track:${i}`);

  await expect(gateway.libraryContains(uris)).rejects.toThrow(RangeError);
});

it('écarte une réponse qui ne correspond pas aux URI demandées', async () => {
  const { gateway } = setup(() => Response.json([true]));

  await expect(gateway.libraryContains(['spotify:track:a', 'spotify:track:b'])).rejects.toThrow(
    new SpotifyError('unavailable'),
  );
});

it('remonte un refus de Spotify', async () => {
  const { gateway } = setup(() => new Response(null, { status: 403 }));

  await expect(gateway.libraryContains(['spotify:track:a'])).rejects.toThrow(
    new SpotifyError('forbidden', 403),
  );
});
