import { describe, expect, it } from 'vitest';

import {
  candidateSchema,
  DECADES,
  FORGE_LIMITS,
  forgeRequestSchema,
  forgeResponseSchema,
  forgeSettingsSchema,
  SHAPES,
} from './forge';
import {
  makeCandidate,
  makeCandidates,
  makeForgeRequest,
  makeForgeResponse,
  makeForgeSettings,
  makeKeptTrack,
  makeTaste,
  makeTrackRef,
} from './testing';

const parseRequest = (input: unknown) => forgeRequestSchema.safeParse(input);

function without(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key));
}

describe('forgeRequestSchema', () => {
  it('accepte une requête minimale et applique les valeurs par défaut', () => {
    const result = forgeRequestSchema.parse({
      prompt: 'Un dimanche matin',
      length: { unit: 'tracks', value: 12 },
      discovery: 0,
      shape: 'free',
    });

    expect(result).toEqual({
      prompt: 'Un dimanche matin',
      length: { unit: 'tracks', value: 12 },
      discovery: 0,
      decades: [],
      shape: 'free',
      locale: 'fr',
    });
  });

  it('accepte une requête complète de reforge', () => {
    const request = makeForgeRequest({
      decades: ['80s', '90s'],
      taste: makeTaste(),
      keep: [makeKeptTrack(0), makeKeptTrack(3)],
      avoid: [makeTrackRef(7), makeTrackRef(8)],
      locale: 'en-GB',
    });

    expect(forgeRequestSchema.parse(request)).toEqual(request);
  });

  it.each([
    [FORGE_LIMITS.discovery.min, true],
    [FORGE_LIMITS.discovery.max, true],
    [-1, false],
    [101, false],
    [50.5, false],
  ])('découverte à %s : valide = %s', (discovery, valid) => {
    expect(parseRequest(makeForgeRequest({ discovery })).success).toBe(valid);
  });

  it.each([
    ['minutes', 9, false],
    ['minutes', 10, true],
    ['minutes', 120, true],
    ['minutes', 121, false],
    ['minutes', 40.5, false],
    ['tracks', 2, false],
    ['tracks', 3, true],
    ['tracks', 30, true],
    ['tracks', 31, false],
  ] as const)('longueur %s = %s : valide = %s', (unit, value, valid) => {
    expect(parseRequest(makeForgeRequest({ length: { unit, value } })).success).toBe(valid);
  });

  it('refuse une unité de longueur inconnue', () => {
    expect(
      parseRequest({ ...makeForgeRequest(), length: { unit: 'hours', value: 1 } }).success,
    ).toBe(false);
  });

  it('accepte toutes les décennies autorisées, et elles seules', () => {
    expect(parseRequest(makeForgeRequest({ decades: [...DECADES] })).success).toBe(true);
    expect(parseRequest({ ...makeForgeRequest(), decades: ['50s'] }).success).toBe(false);
  });

  it('refuse une décennie en double', () => {
    expect(parseRequest(makeForgeRequest({ decades: ['80s', '80s'] })).success).toBe(false);
  });

  it.each(SHAPES)('accepte la progression %s', (shape) => {
    expect(parseRequest(makeForgeRequest({ shape })).success).toBe(true);
  });

  it('refuse une progression inconnue', () => {
    expect(parseRequest({ ...makeForgeRequest(), shape: 'zigzag' }).success).toBe(false);
  });

  it('nettoie le minerai et refuse un minerai vide ou trop long', () => {
    expect(forgeRequestSchema.parse(makeForgeRequest({ prompt: '  Pluie  ' })).prompt).toBe(
      'Pluie',
    );
    expect(parseRequest(makeForgeRequest({ prompt: '   ' })).success).toBe(false);
    expect(
      parseRequest(makeForgeRequest({ prompt: 'a'.repeat(FORGE_LIMITS.prompt.maxLength + 1) }))
        .success,
    ).toBe(false);
  });

  it('refuse deux titres trempés à la même position, ou une position négative', () => {
    expect(
      parseRequest(makeForgeRequest({ keep: [makeKeptTrack(2, 1), makeKeptTrack(2, 2)] })).success,
    ).toBe(false);
    expect(parseRequest(makeForgeRequest({ keep: [makeKeptTrack(-1)] })).success).toBe(false);
  });

  it('refuse une langue mal formée', () => {
    expect(parseRequest(makeForgeRequest({ locale: 'français' })).success).toBe(false);
  });

  it('complète les genres absents du résumé des écoutes', () => {
    const request = forgeRequestSchema.parse({
      ...makeForgeRequest(),
      taste: { topArtists: ['Les Braises'], recentArtists: [] },
    });

    expect(request.taste).toEqual({ topArtists: ['Les Braises'], recentArtists: [], genres: [] });
  });

  it('retire les champs inconnus, même dans le résumé des écoutes', () => {
    const request = forgeRequestSchema.parse({
      ...makeForgeRequest(),
      spotifyUserId: 'ne-doit-pas-passer',
      taste: { ...makeTaste(), playedAt: '2026-11-11T20:00:00Z' },
    });

    expect(request).not.toHaveProperty('spotifyUserId');
    expect(request.taste).not.toHaveProperty('playedAt');
  });
});

describe('forgeSettingsSchema', () => {
  it("exige l'interrupteur « mes écoutes »", () => {
    const settings = without(makeForgeSettings(), 'useTaste');

    expect(forgeSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('complète les décennies absentes par « toutes »', () => {
    const settings = without(makeForgeSettings(), 'decades');

    expect(forgeSettingsSchema.parse(settings).decades).toEqual([]);
  });
});

describe('candidateSchema', () => {
  it.each([
    [{ slot: 0 }, true],
    [{ slot: 1 }, true],
    [{ slot: 0.42 }, true],
    [{ slot: -0.1 }, false],
    [{ slot: 1.1 }, false],
    [{ year: FORGE_LIMITS.year.min - 1 }, false],
    [{ year: 1999.5 }, false],
    [{ reason: '' }, false],
    [{ artist: ' ' }, false],
  ])('%o : valide = %s', (overrides, valid) => {
    expect(candidateSchema.safeParse(makeCandidate(overrides)).success).toBe(valid);
  });

  it('exige le champ familiar', () => {
    const candidate = without(makeCandidate(), 'familiar');

    expect(candidateSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('forgeResponseSchema', () => {
  it('accepte une réponse valide', () => {
    const response = makeForgeResponse();

    expect(forgeResponseSchema.parse(response)).toEqual(response);
  });

  it('refuse une réponse sans candidat', () => {
    expect(forgeResponseSchema.safeParse(makeForgeResponse({ candidates: [] })).success).toBe(
      false,
    );
  });

  it('refuse trop de candidats ou un titre trop long', () => {
    const tooMany = makeCandidates(FORGE_LIMITS.candidates.max + 1);
    const longTitle = 'x'.repeat(FORGE_LIMITS.title.maxLength + 1);

    expect(forgeResponseSchema.safeParse(makeForgeResponse({ candidates: tooMany })).success).toBe(
      false,
    );
    expect(forgeResponseSchema.safeParse(makeForgeResponse({ title: longTitle })).success).toBe(
      false,
    );
  });

  it('retire les champs inconnus ajoutés par le modèle', () => {
    const response = forgeResponseSchema.parse({
      ...makeForgeResponse({ candidates: [makeCandidate()] }),
      commentary: 'bavardage du modèle',
      candidates: [{ ...makeCandidate(), spotifyUri: 'spotify:track:inventé' }],
    });

    expect(response).not.toHaveProperty('commentary');
    expect(response.candidates[0]).not.toHaveProperty('spotifyUri');
  });
});

describe('fabriques de test', () => {
  it('produisent des données conformes au contrat', () => {
    expect(forgeSettingsSchema.parse(makeForgeSettings())).toEqual(makeForgeSettings());
    expect(forgeRequestSchema.parse(makeForgeRequest())).toEqual(makeForgeRequest());
    expect(forgeResponseSchema.parse(makeForgeResponse())).toEqual(makeForgeResponse());
  });

  it('répartissent les candidats de 0 à 1, sans doublon', () => {
    const candidates = makeCandidates(5);

    expect(candidates.map((candidate) => candidate.slot)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(new Set(candidates.map((candidate) => candidate.title)).size).toBe(5);
    expect(makeCandidates(1)[0]?.slot).toBe(0);
  });
});
