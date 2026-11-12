import type { Candidate } from '@spotiforge/shared';
import { makeCandidate, makeForgeRequest } from '@spotiforge/shared/testing';
import { describe, expect, it } from 'vitest';

import type { CatalogTrack } from '../../mobile/src/domain/match';
import {
  type CandidateCheck,
  type CaseMetrics,
  inDecades,
  measureCase,
  summarize,
} from './metrics';

const track = (overrides: Partial<CatalogTrack> = {}): CatalogTrack => ({
  spotifyUri: 'spotify:track:fake',
  title: 'Titre',
  artists: ['Artiste'],
  durationMs: 200_000,
  ...overrides,
});

const found = (candidate: Partial<Candidate>, year?: number): CandidateCheck => ({
  candidate: makeCandidate(candidate),
  match: track(year === undefined ? {} : { year }),
});
const missing = (candidate: Partial<Candidate>): CandidateCheck => ({
  candidate: makeCandidate(candidate),
  match: null,
});

describe('inDecades', () => {
  it.each([
    [1970, ['70s'], true],
    [1979, ['70s'], true],
    [1980, ['70s'], false],
    [2005, ['00s'], true],
    [2021, ['20s'], true],
    // « 20s » désigne les années 2020, pas 1920.
    [1925, ['20s'], false],
    [1999, ['60s', '90s'], true],
  ] as const)('%i dans %j : %s', (year, decades, expected) => {
    expect(inDecades(year, decades)).toBe(expected);
  });
});

describe('measureCase', () => {
  it('compte les titres trouvés sur Spotify', () => {
    const checks = [
      found({ artist: 'A', title: '1' }),
      missing({ artist: 'B', title: '2' }),
      found({ artist: 'C', title: '3' }),
      found({ artist: 'D', title: '4' }),
    ];

    expect(measureCase(makeForgeRequest(), checks).found).toEqual({ matching: 3, total: 4 });
  });

  it('vérifie les décennies d’après le modèle et d’après Spotify', () => {
    const request = makeForgeRequest({ decades: ['70s', '80s'] });
    const checks = [
      found({ artist: 'A', title: '1', year: 1975 }, 1975),
      // Daté par le modèle dans la bonne décennie, mais Spotify ne connaît que la réédition.
      found({ artist: 'B', title: '2', year: 1983 }, 2011),
      missing({ artist: 'C', title: '3', year: 1992 }),
      // Sans année connue sur Spotify : ignoré du second compte.
      found({ artist: 'D', title: '4', year: 1979 }),
    ];

    const metrics = measureCase(request, checks);

    expect(metrics.candidateYears).toEqual({ matching: 3, total: 4 });
    expect(metrics.spotifyYears).toEqual({ matching: 1, total: 2 });
  });

  it('ne mesure pas les décennies quand toutes les époques sont permises', () => {
    const metrics = measureCase(makeForgeRequest({ decades: [] }), [found({ year: 1950 })]);

    expect(metrics.candidateYears).toBeNull();
    expect(metrics.spotifyYears).toBeNull();
  });

  it('repère les artistes trop présents et répétés à la suite, après normalisation', () => {
    const checks = [
      found({ artist: 'The Artist', title: '1', slot: 0 }),
      found({ artist: 'Autre', title: '2', slot: 0.25 }),
      found({ artist: 'artist', title: '3', slot: 0.5 }),
      found({ artist: 'ARTIST', title: '4', slot: 0.75 }),
      found({ artist: 'Autre', title: '5', slot: 1 }),
    ];

    const metrics = measureCase(makeForgeRequest(), checks);

    expect(metrics.overusedArtists).toEqual([{ artist: 'The Artist', count: 3 }]);
    // « artist » puis « ARTIST » (places 0,5 et 0,75).
    expect(metrics.consecutiveRepeats).toBe(1);
  });

  it('suit l’ordre de la progression (slot), pas l’ordre de la réponse', () => {
    const checks = [
      found({ artist: 'A', title: '1', slot: 0 }),
      found({ artist: 'A', title: '2', slot: 1 }),
      found({ artist: 'B', title: '3', slot: 0.5 }),
    ];

    expect(measureCase(makeForgeRequest(), checks).consecutiveRepeats).toBe(0);
  });

  it('repère les titres proposés deux fois, même écrits autrement', () => {
    const checks = [
      found({ artist: 'Röyksopp', title: 'Eple' }),
      found({ artist: 'Royksopp', title: 'Eple - Remastered' }),
      found({ artist: 'Röyksopp', title: 'Autre' }),
    ];

    expect(measureCase(makeForgeRequest(), checks).duplicateTracks).toEqual([
      { artist: 'Royksopp', title: 'Eple - Remastered' },
    ]);
  });

  it('repère les candidats repris de avoid ou de keep', () => {
    const request = makeForgeRequest({
      avoid: [{ artist: 'Refusé', title: 'Déjà vu' }],
      keep: [{ position: 0, artist: 'Trempé', title: 'Gardé' }],
    });
    const checks = [
      found({ artist: 'refuse', title: 'Deja Vu' }),
      found({ artist: 'Trempé', title: 'Gardé (Live)' }),
      found({ artist: 'Nouveau', title: 'Titre' }),
    ];

    expect(measureCase(request, checks).avoidViolations).toEqual([
      { artist: 'refuse', title: 'Deja Vu' },
      { artist: 'Trempé', title: 'Gardé (Live)' },
    ]);
  });
});

describe('summarize', () => {
  const metrics = (overrides: Partial<CaseMetrics> = {}): CaseMetrics => ({
    found: { matching: 8, total: 10 },
    candidateYears: null,
    spotifyYears: null,
    overusedArtists: [],
    consecutiveRepeats: 0,
    duplicateTracks: [],
    avoidViolations: [],
    ...overrides,
  });

  it('additionne les forges et atteint le critère à quatre titres réels sur cinq', () => {
    const summary = summarize(
      [
        metrics({ candidateYears: { matching: 9, total: 10 }, consecutiveRepeats: 1 }),
        metrics({
          found: { matching: 12, total: 15 },
          avoidViolations: [{ artist: 'A', title: 'B' }],
        }),
      ],
      0,
    );

    expect(summary).toEqual({
      forged: 2,
      failed: 0,
      found: { matching: 20, total: 25 },
      candidateYears: { matching: 9, total: 10 },
      overusedArtists: 0,
      consecutiveRepeats: 1,
      duplicateTracks: 0,
      avoidViolations: 1,
      meetsFoundCriterion: true,
    });
  });

  it('n’atteint pas le critère sous 80 %', () => {
    expect(
      summarize([metrics({ found: { matching: 79, total: 100 } })], 0).meetsFoundCriterion,
    ).toBe(false);
  });

  it('n’atteint pas le critère quand une forge a échoué ou que rien n’a été forgé', () => {
    expect(summarize([metrics()], 1).meetsFoundCriterion).toBe(false);
    expect(summarize([], 0).meetsFoundCriterion).toBe(false);
  });
});
