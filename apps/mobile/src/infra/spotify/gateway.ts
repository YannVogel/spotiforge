import type { SpotifyGateway } from '../../domain/spotify';
import type { SpotifyHttp } from './http';
import { meSchema, searchTracksSchema, toAccount, toCatalogTracks } from './schemas';

/** Limite de `GET /search` en 2026 (docs/SPOTIFY_API.md). */
export const SEARCH_LIMIT = 10;

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
  };
}
