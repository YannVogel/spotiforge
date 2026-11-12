import { FORGE_LIMITS, type Taste } from '@spotiforge/shared';

import { normalizeArtistName } from './normalize';
import { SpotifyError, type SpotifyGateway } from './spotify';

/** Un artiste parmi les plus écoutés : son nom et ses genres, rien d'autre. */
export type ListenedArtist = { name: string; genres: readonly string[] };

/** Ce que l'on lit sur Spotify pour résumer les goûts de la personne. */
export type ListeningHistory = {
  topArtists: readonly ListenedArtist[];
  /** Artistes des écoutes récentes, de la plus récente à la plus ancienne. */
  recentArtists: readonly string[];
};

/** Un résumé reste valable une journée : les goûts bougent lentement, le quota est partagé. */
export const TASTE_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedTaste = {
  taste: Taste;
  /** Date ISO 8601 de la lecture sur Spotify. */
  fetchedAt: string;
};

/** Résumé gardé sur le téléphone, par compte. */
export interface TasteCache {
  get(ownerSpotifyId: string): Promise<CachedTaste | undefined>;
  set(ownerSpotifyId: string, cached: CachedTaste): Promise<void>;
}

export type TasteResult =
  | { status: 'ready'; taste: Taste }
  /** Spotify ne donne pas les écoutes : la forge se fait sans alliage. */
  | { status: 'unavailable' };

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, FORGE_LIMITS.text.maxLength).trim();
}

/** Noms nettoyés, sans doublon (à la normalisation près), dans l'ordre, `max` au plus. */
function uniqueNames(names: Iterable<string>, max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const cleaned = cleanName(name);
    const key = normalizeArtistName(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length === max) break;
  }
  return result;
}

/** Genres des artistes les plus écoutés, du plus fréquent au moins fréquent (ordre d'apparition à égalité). */
function topGenres(artists: readonly ListenedArtist[]): string[] {
  const counts = new Map<string, { genre: string; count: number }>();
  for (const artist of artists) {
    for (const genre of new Set(artist.genres.map((g) => cleanName(g).toLowerCase()))) {
      if (!genre) continue;
      const entry = counts.get(genre) ?? { genre, count: 0 };
      entry.count++;
      counts.set(genre, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, FORGE_LIMITS.tasteGenres.max)
    .map(({ genre }) => genre);
}

/**
 * Résume les écoutes en champ `taste` : des noms d'artistes et de genres, sans identifiant ni
 * horodatage (docs/GENERATION.md), dans les bornes du contrat.
 */
export function summarizeTaste(history: ListeningHistory): Taste {
  const max = FORGE_LIMITS.tasteArtists.max;
  return {
    topArtists: uniqueNames(
      history.topArtists.map((artist) => artist.name),
      max,
    ),
    recentArtists: uniqueNames(history.recentArtists, max),
    genres: topGenres(history.topArtists),
  };
}

export function isTasteFresh(cached: CachedTaste, now: Date): boolean {
  const age = now.getTime() - Date.parse(cached.fetchedAt);
  return age >= 0 && age < TASTE_TTL_MS;
}

/** Artistes écoutés, normalisés : un titre de l'un d'eux compte comme « connu » (#33). */
export function listenedArtistKeys(taste: Taste): Set<string> {
  return new Set(
    [...taste.topArtists, ...taste.recentArtists].map(normalizeArtistName).filter(Boolean),
  );
}

type Dependencies = {
  gateway: Pick<SpotifyGateway, 'getTopArtists' | 'getRecentlyPlayedArtists'>;
  cache: TasteCache;
  ownerSpotifyId: string;
  now: () => Date;
};

/**
 * Panne de Spotify dont l'alliage peut se passer. Une session expirée, elle, doit remonter (retour
 * à la connexion), comme toute erreur qui n'est pas une réponse de Spotify.
 */
function canDoWithout(reason: unknown): boolean {
  return reason instanceof SpotifyError && reason.kind !== 'unauthorized';
}

/**
 * Résumé des écoutes, lu sur Spotify au plus une fois par jour. Si Spotify ne répond pas (endpoint
 * retiré, quota, réseau…), on garde un ancien résumé s'il existe, sinon l'alliage est indisponible :
 * la forge ne doit pas échouer pour ça. Une seule des deux lectures suffit.
 */
export async function loadTaste({
  gateway,
  cache,
  ownerSpotifyId,
  now,
}: Dependencies): Promise<TasteResult> {
  const cached = await cache.get(ownerSpotifyId);
  if (cached && isTasteFresh(cached, now())) return { status: 'ready', taste: cached.taste };

  const [top, recent] = await Promise.allSettled([
    gateway.getTopArtists(),
    gateway.getRecentlyPlayedArtists(),
  ]);
  for (const outcome of [top, recent]) {
    if (outcome.status === 'rejected' && !canDoWithout(outcome.reason)) throw outcome.reason;
  }
  if (top.status === 'rejected' && recent.status === 'rejected') {
    return cached ? { status: 'ready', taste: cached.taste } : { status: 'unavailable' };
  }

  const taste = summarizeTaste({
    topArtists: top.status === 'fulfilled' ? top.value : [],
    recentArtists: recent.status === 'fulfilled' ? recent.value : [],
  });
  await cache.set(ownerSpotifyId, { taste, fetchedAt: now().toISOString() });
  return { status: 'ready', taste };
}
