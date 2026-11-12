import { SpotifyError } from '../../domain/spotify';
import { createSpotifyGateway } from './gateway';
import { createSpotifyHttp } from './http';

// Réponses Spotify simulées, inventées, avec des éléments incomplets et des champs inattendus.

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
  return { gateway: createSpotifyGateway(request), urls };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getTopArtists', () => {
  it('lit les 50 artistes les plus écoutés des six derniers mois, genres compris', async () => {
    const { gateway, urls } = setup(() =>
      Response.json({
        items: [
          { id: 'x', name: 'Kavinsky', genres: ['synthwave', 'french house'], popularity: 70 },
          { name: 'M83' },
          null,
          { genres: ['sans nom'] },
          { name: 'Desire', genres: null },
        ],
        total: 3,
        next: null,
      }),
    );

    expect(await gateway.getTopArtists()).toEqual([
      { name: 'Kavinsky', genres: ['synthwave', 'french house'] },
      { name: 'M83', genres: [] },
      { name: 'Desire', genres: [] },
    ]);
    const [url] = urls;
    expect(url?.pathname).toBe('/v1/me/top/artists');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      limit: '50',
      time_range: 'medium_term',
    });
  });

  it('remonte une erreur Spotify quand l’endpoint n’existe plus', async () => {
    const { gateway } = setup(() => new Response(null, { status: 404 }));

    await expect(gateway.getTopArtists()).rejects.toThrow(new SpotifyError('unavailable', 404));
  });
});

describe('getRecentlyPlayedArtists', () => {
  it('ne garde que les noms d’artistes des écoutes récentes, dans l’ordre', async () => {
    const { gateway, urls } = setup(() =>
      Response.json({
        items: [
          {
            track: { name: 'Nightcall', artists: [{ name: 'Kavinsky' }, { name: 'Lovefoxxx' }] },
            played_at: '2026-11-12T07:00:00Z',
          },
          { track: null, played_at: '2026-11-12T06:00:00Z' },
          { track: { name: 'Midnight City', artists: [{ name: 'M83' }] } },
        ],
        cursors: { after: '1', before: '0' },
      }),
    );

    expect(await gateway.getRecentlyPlayedArtists()).toEqual(['Kavinsky', 'Lovefoxxx', 'M83']);
    expect(urls[0]?.pathname).toBe('/v1/me/player/recently-played');
    expect(urls[0]?.searchParams.get('limit')).toBe('50');
  });

  it('accepte une liste vide (compte neuf)', async () => {
    const { gateway } = setup(() => Response.json({ items: [] }));

    expect(await gateway.getRecentlyPlayedArtists()).toEqual([]);
  });
});
