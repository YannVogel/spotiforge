// Données de test inventées pour les dépôts.
import { makeForgeSettings } from '@spotiforge/shared/testing';

import type { Mold, PieceRecord } from '../../domain/history';
import { makePieceTrack } from '../../domain/test-fixtures';

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
