// Données de test inventées pour le domaine (et les couches qui en dépendent).
import { makeForgeSettings } from '@spotiforge/shared/testing';

import type { Mold, PieceRecord } from './history';
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

export function makePieceRecord(overrides: Partial<PieceRecord> = {}): PieceRecord {
  return {
    id: 'piece-1',
    ownerSpotifyId: 'owner-a',
    title: 'Route de nuit',
    description: 'Des synthés qui montent doucement.',
    prompt: 'Route de nuit au bord de la mer',
    settings: makeForgeSettings({ decades: ['80s', '10s'], useTaste: true }),
    spotifyPlaylistId: null,
    createdAt: '2026-11-10T20:00:00.000Z',
    updatedAt: '2026-11-10T20:00:00.000Z',
    sentAt: null,
    tracks: [
      makePieceTrack(1, { quenched: true, slot: 0.1, known: true }),
      makePieceTrack(2, { slot: 0.5, known: false }),
      makePieceTrack(3, { quenched: true, slot: 0.9, durationMs: 301_500 }),
    ],
    rejected: [
      { spotifyUri: 'spotify:track:fake8', artist: 'Artiste 8', title: 'Titre 8' },
      { spotifyUri: 'spotify:track:fake9', artist: 'Artiste 9', title: 'Titre 9' },
    ],
    ...overrides,
  };
}

export function makeMold(overrides: Partial<Mold> = {}): Mold {
  return {
    id: 'mold-1',
    ownerSpotifyId: 'owner-a',
    name: 'Dimanche matin',
    prompt: 'Un dimanche matin lent',
    settings: makeForgeSettings({ shape: 'fall' }),
    createdAt: '2026-11-10T20:00:00.000Z',
    ...overrides,
  };
}
