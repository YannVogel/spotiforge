import type { SpotifyGateway } from '../../domain/spotify';
import type { SpotifyHttp } from './http';
import { meSchema, toAccount } from './schemas';

/** Implémentation de `SpotifyGateway` : un endpoint confirmé de docs/SPOTIFY_API.md par méthode. */
export function createSpotifyGateway(request: SpotifyHttp): SpotifyGateway {
  return {
    async getCurrentAccount() {
      return toAccount(await request('/me', meSchema));
    },
  };
}
