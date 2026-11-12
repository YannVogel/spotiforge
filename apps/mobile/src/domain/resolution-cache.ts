import type { CatalogTrack } from './match';
import { normalizeArtistName, parseTitle } from './normalize';

export type CachedResolution = {
  /** `null` : le titre a été cherché et n'existe pas au catalogue. */
  track: CatalogTrack | null;
  /** Date ISO 8601 de la résolution. */
  resolvedAt: string;
};

/** Cache des résolutions déjà faites, par couple artiste/titre normalisé. */
export interface ResolutionCache {
  get(key: string): Promise<CachedResolution | undefined>;
  set(key: string, resolution: CachedResolution): Promise<void>;
}

/** Clé de cache : artiste et titre normalisés, variantes et invités retirés. */
export function resolutionKey(artist: string, title: string): string {
  const [form = ''] = parseTitle(title).forms;
  return `${normalizeArtistName(artist)}|${form}`;
}
