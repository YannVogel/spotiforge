import type { SpotifyGateway } from '../../domain/spotify';
import type { SpotifyHttp } from './http';
import {
  itemsPageSchema,
  meSchema,
  searchTracksSchema,
  toAccount,
  toCatalogTracks,
  toListenedArtists,
  toRecentArtistNames,
} from './schemas';

/** Limite de `GET /search` en 2026 (docs/SPOTIFY_API.md). */
export const SEARCH_LIMIT = 10;
/** Limite de `GET /me/top/{type}` et de `GET /me/player/recently-played`. */
export const LISTENING_LIMIT = 50;

/** Retire ce qui casserait les filtres de champ de la recherche (`:` et guillemets). */
function searchTerm(value: string): string {
  return value.replace(/[:"]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Implémentation de `SpotifyGateway` : un endpoint confirmé de docs/SPOTIFY_API.md par méthode. */
export function createSpotifyGateway(request: SpotifyHttp): SpotifyGateway {
  return {
    async getCurrentAccount() {
      return toAccount(await request('/me', meSchema));
    },

    async searchTracks({ artist, title }) {
      const params = new URLSearchParams({
        q: `track:${searchTerm(title)} artist:${searchTerm(artist)}`,
        type: 'track',
        limit: String(SEARCH_LIMIT),
      });
      return toCatalogTracks(await request(`/search?${params.toString()}`, searchTracksSchema));
    },

    async getTopArtists() {
      const params = new URLSearchParams({
        limit: String(LISTENING_LIMIT),
        time_range: 'medium_term',
      });
      return toListenedArtists(
        await request(`/me/top/artists?${params.toString()}`, itemsPageSchema),
      );
    },

    async getRecentlyPlayedArtists() {
      const params = new URLSearchParams({ limit: String(LISTENING_LIMIT) });
      return toRecentArtistNames(
        await request(`/me/player/recently-played?${params.toString()}`, itemsPageSchema),
      );
    },
  };
}
