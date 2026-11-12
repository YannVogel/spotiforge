import type { Candidate, TrackRef } from '@spotiforge/shared';

import { type CatalogTrack, findBestMatch } from './match';
import type { ResolutionCache } from './resolution-cache';
import { resolutionKey } from './resolution-cache';
import { SpotifyError, type SpotifyGateway } from './spotify';
import type { ResolvedTrack } from './track';

/** Recherches simultanées au plus, pour ménager le quota partagé (docs/SPOTIFY_API.md). */
export const MAX_CONCURRENT_SEARCHES = 3;

export type DiscardReason =
  /** Aucun résultat ne correspond assez. */
  | 'not_found'
  /** Même titre qu'un candidat déjà retenu. */
  | 'duplicate'
  /** Titre refusé, déjà dans la pièce, ou dans `avoid`. */
  | 'avoided'
  /** Spotify n'a pas pu répondre pour ce titre (quota) : à retenter plus tard. */
  | 'unavailable';

export type Discarded = { candidate: Candidate; reason: DiscardReason };
export type ResolutionResult = { resolved: ResolvedTrack[]; discarded: Discarded[] };

type Dependencies = {
  search: SpotifyGateway['searchTracks'];
  cache: ResolutionCache;
  now: () => Date;
  /** Avancement, pour l'état de chargement : `done` candidats traités sur `total`. */
  onProgress?: (done: number, total: number) => void;
};

type Options = {
  /** À ne pas proposer (refusés, titres déjà dans la pièce), par artiste et titre. */
  avoid?: readonly TrackRef[];
  /** URI déjà présentes ou refusées dans la pièce. */
  excludedUris?: ReadonlySet<string>;
};

type Lookup = CatalogTrack | null | 'unavailable';

function toResolvedTrack(candidate: Candidate, track: CatalogTrack): ResolvedTrack {
  return {
    spotifyUri: track.spotifyUri,
    title: track.title,
    artist: track.artists.join(', '),
    year: track.year ?? candidate.year,
    durationMs: track.durationMs,
    reason: candidate.reason,
    // Estimation du LLM ; le marquage « connu » d'après la bibliothèque (#33) la remplacera.
    known: candidate.familiar,
    slot: candidate.slot,
  };
}

/** Exécute `task` sur chaque élément, `limit` à la fois (les « ouvriers » se partagent un itérateur). */
async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
) {
  const queue = items.values();
  const worker = async () => {
    for (const item of queue) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Transforme les candidats du LLM en titres Spotify réels : une recherche par couple
 * artiste/titre normalisé (jamais deux fois le même, résultats gardés en cache, introuvables
 * compris), au plus 3 à la fois. Écarte les introuvables, les doublons et ce qu'il faut éviter.
 * Un quota dépassé n'écarte que le titre concerné ; une autre panne de Spotify interrompt tout.
 */
export async function resolveCandidates(
  candidates: readonly Candidate[],
  { search, cache, now, onProgress }: Dependencies,
  { avoid = [], excludedUris = new Set() }: Options = {},
): Promise<ResolutionResult> {
  const avoidedKeys = new Set(avoid.map((track) => resolutionKey(track.artist, track.title)));
  const entries = candidates.map((candidate) => ({
    candidate,
    key: resolutionKey(candidate.artist, candidate.title),
  }));

  // Une seule recherche par clé, pour le premier candidat qui la porte.
  const toLookUp = new Map<string, Candidate>();
  const occurrences = new Map<string, number>();
  for (const { candidate, key } of entries) {
    if (avoidedKeys.has(key)) continue;
    if (!toLookUp.has(key)) toLookUp.set(key, candidate);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  let done = candidates.length - [...occurrences.values()].reduce((sum, n) => sum + n, 0);
  onProgress?.(done, candidates.length);

  async function lookUp(candidate: Candidate, key: string): Promise<Lookup> {
    const cached = await cache.get(key);
    if (cached) return cached.track;
    try {
      const track = findBestMatch(candidate, await search(candidate));
      await cache.set(key, { track, resolvedAt: now().toISOString() });
      return track;
    } catch (error) {
      if (error instanceof SpotifyError && error.kind === 'rate_limited') return 'unavailable';
      throw error;
    }
  }

  const lookups = new Map<string, Lookup>();
  await forEachLimited([...toLookUp], MAX_CONCURRENT_SEARCHES, async ([key, candidate]) => {
    lookups.set(key, await lookUp(candidate, key));
    done += occurrences.get(key) ?? 0;
    onProgress?.(done, candidates.length);
  });

  const result: ResolutionResult = { resolved: [], discarded: [] };
  const seenKeys = new Set<string>();
  const seenUris = new Set<string>();
  for (const { candidate, key } of entries) {
    const reason = discardReason(key, lookups.get(key));
    if (reason) {
      result.discarded.push({ candidate, reason });
      continue;
    }
    const track = lookups.get(key);
    if (track && track !== 'unavailable') {
      seenKeys.add(key);
      seenUris.add(track.spotifyUri);
      result.resolved.push(toResolvedTrack(candidate, track));
    }
  }
  return result;

  function discardReason(key: string, lookup: Lookup | undefined): DiscardReason | null {
    if (avoidedKeys.has(key)) return 'avoided';
    if (seenKeys.has(key)) return 'duplicate';
    if (lookup === 'unavailable') return 'unavailable';
    if (!lookup) return 'not_found';
    if (excludedUris.has(lookup.spotifyUri)) return 'avoided';
    if (seenUris.has(lookup.spotifyUri)) return 'duplicate';
    return null;
  }
}
