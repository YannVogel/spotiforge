import { SpotifyError, type SpotifyGateway } from '../../domain/spotify';
import type { SpotifyHttp } from './http';
import {
  anyResponseSchema,
  createdPlaylistSchema,
  itemsPageSchema,
  libraryContainsSchema,
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
/** URI au plus par appel à `GET /me/library/contains`. */
export const LIBRARY_CONTAINS_LIMIT = 40;
/** URI au plus par appel à `POST` ou `PUT /playlists/{id}/items`. */
export const PLAYLIST_ITEMS_LIMIT = 100;

function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function itemsBatch(uris: readonly string[]): { uris: string[] } {
  if (uris.length > PLAYLIST_ITEMS_LIMIT) {
    throw new RangeError(`Playlist items calls accept ${PLAYLIST_ITEMS_LIMIT} URIs at most`);
  }
  return { uris: [...uris] };
}

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

    async libraryContains(uris) {
      if (uris.length === 0) return [];
      if (uris.length > LIBRARY_CONTAINS_LIMIT) {
        throw new RangeError(`libraryContains accepts ${LIBRARY_CONTAINS_LIMIT} URIs at most`);
      }
      const params = new URLSearchParams({ uris: uris.join(',') });
      const saved = await request(
        `/me/library/contains?${params.toString()}`,
        libraryContainsSchema,
      );
      // Une réponse qui ne correspond pas aux URI demandées est inexploitable.
      if (saved.length !== uris.length) throw new SpotifyError('unavailable');
      return saved;
    },

    async createPlaylist({ name, description }) {
      // Privée par défaut (docs/PRODUCT.md).
      return request(
        '/me/playlists',
        createdPlaylistSchema,
        json('POST', { name, description, public: false }),
      );
    },

    async updatePlaylistDetails(playlistId, { name, description }) {
      await request(
        `/playlists/${encodeURIComponent(playlistId)}`,
        anyResponseSchema,
        json('PUT', { name, description }),
      );
    },

    async replacePlaylistItems(playlistId, uris) {
      await request(
        `/playlists/${encodeURIComponent(playlistId)}/items`,
        anyResponseSchema,
        json('PUT', itemsBatch(uris)),
      );
    },

    async addPlaylistItems(playlistId, uris) {
      await request(
        `/playlists/${encodeURIComponent(playlistId)}/items`,
        anyResponseSchema,
        json('POST', itemsBatch(uris)),
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
