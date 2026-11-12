// Données de test inventées pour le domaine.
import type { PieceTrack, ResolvedTrack } from './track';

export function makeResolvedTrack(
  n: number,
  overrides: Partial<ResolvedTrack> = {},
): ResolvedTrack {
  return {
    spotifyUri: `spotify:track:fake${n}`,
    title: `Titre ${n}`,
    artist: `Artiste ${n}`,
    year: 1980 + (n % 40),
    durationMs: 240_000,
    reason: `Raison ${n}`,
    known: n % 2 === 0,
    slot: 0,
    ...overrides,
  };
}

export function makePieceTrack(n: number, overrides: Partial<PieceTrack> = {}): PieceTrack {
  return { ...makeResolvedTrack(n), quenched: false, ...overrides };
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : tests de propriétés reproductibles. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
