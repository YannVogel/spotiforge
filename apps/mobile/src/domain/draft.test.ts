import { FORGE_LIMITS, forgeRequestSchema } from '@spotiforge/shared';
import { makeForgeSettings, makeTaste } from '@spotiforge/shared/testing';

import {
  canForge,
  createDraft,
  DEFAULT_SETTINGS,
  type Draft,
  draftFrom,
  setDiscovery,
  setLengthUnit,
  setLengthValue,
  setPrompt,
  setShape,
  setUseTaste,
  toForgeRequest,
  toggleDecade,
} from './draft';

const withPrompt = (prompt = 'Route de nuit') => setPrompt(createDraft(), prompt);

describe('valeurs par défaut', () => {
  it('démarre sans minerai, 40 minutes, découverte 50 %, toutes époques, progression libre, sans alliage', () => {
    expect(createDraft()).toEqual({
      prompt: '',
      settings: {
        length: { unit: 'minutes', value: 40 },
        discovery: 50,
        decades: [],
        shape: 'free',
        useTaste: false,
      },
    });
  });

  it('donne des réglages valides pour le contrat', () => {
    expect(() => forgeRequestSchema.parse({ ...DEFAULT_SETTINGS, prompt: 'x' })).not.toThrow();
  });

  it('crée un brouillon neuf à chaque fois', () => {
    const first = toggleDecade(createDraft(), '80s');

    expect(createDraft().settings.decades).toEqual([]);
    expect(first.settings.decades).toEqual(['80s']);
  });
});

describe('bornes et pas', () => {
  it.each([
    [42, 40],
    [43, 45],
    [5, 10],
    [500, 120],
  ])('longueur %s min → %s min', (value, expected) => {
    expect(setLengthValue(createDraft(), value).settings.length).toEqual({
      unit: 'minutes',
      value: expected,
    });
  });

  it('borne aussi une longueur en titres, au titre près', () => {
    const tracks = setLengthUnit(createDraft(), 'tracks');

    expect(setLengthValue(tracks, 7.4).settings.length).toEqual({ unit: 'tracks', value: 7 });
    expect(setLengthValue(tracks, 1).settings.length.value).toBe(FORGE_LIMITS.length.tracks.min);
    expect(setLengthValue(tracks, 99).settings.length.value).toBe(FORGE_LIMITS.length.tracks.max);
  });

  it.each([
    [64, 60],
    [65, 70],
    [-10, 0],
    [130, 100],
  ])('découverte %s % → %s %', (value, expected) => {
    expect(setDiscovery(createDraft(), value).settings.discovery).toBe(expected);
  });

  it('limite le minerai à la longueur du contrat', () => {
    const long = 'a'.repeat(FORGE_LIMITS.prompt.maxLength + 20);

    expect(setPrompt(createDraft(), long).prompt).toHaveLength(FORGE_LIMITS.prompt.maxLength);
  });
});

describe('bascule minutes / titres', () => {
  it('convertit à 4 minutes par titre, dans les deux sens', () => {
    const tracks = setLengthUnit(createDraft(), 'tracks');

    expect(tracks.settings.length).toEqual({ unit: 'tracks', value: 10 });
    expect(setLengthUnit(tracks, 'minutes').settings.length).toEqual({
      unit: 'minutes',
      value: 40,
    });
  });

  it('recale la conversion sur les bornes et les pas', () => {
    const max = setLengthValue(createDraft(), 120);
    const fewTracks = setLengthValue(setLengthUnit(createDraft(), 'tracks'), 3);

    expect(setLengthUnit(max, 'tracks').settings.length.value).toBe(30);
    // 3 titres × 4 = 12 min → pas de 5 depuis 10 → 10 min.
    expect(setLengthUnit(fewTracks, 'minutes').settings.length.value).toBe(10);
  });

  it('ne change rien si l’unité est déjà la bonne', () => {
    const draft = createDraft();

    expect(setLengthUnit(draft, 'minutes')).toBe(draft);
  });
});

describe('époques', () => {
  it('ajoute et retire une décennie, dans l’ordre chronologique', () => {
    let draft = createDraft();
    draft = toggleDecade(draft, '90s');
    draft = toggleDecade(draft, '60s');
    draft = toggleDecade(draft, '20s');

    expect(draft.settings.decades).toEqual(['60s', '90s', '20s']);
    expect(toggleDecade(draft, '90s').settings.decades).toEqual(['60s', '20s']);
  });
});

describe('autres réglages', () => {
  it('change la progression et l’alliage', () => {
    const draft = setUseTaste(setShape(createDraft(), 'wave'), true);

    expect(draft.settings.shape).toBe('wave');
    expect(draft.settings.useTaste).toBe(true);
  });
});

describe('canForge', () => {
  it('exige un minerai qui ne soit pas que des espaces', () => {
    expect(canForge(createDraft())).toBe(false);
    expect(canForge(withPrompt('   '))).toBe(false);
    expect(canForge(withPrompt('Pluie'))).toBe(true);
  });
});

describe('toForgeRequest', () => {
  it('produit une ForgeRequest valide', () => {
    let draft: Draft = withPrompt('  Route de nuit  ');
    draft = toggleDecade(setShape(setDiscovery(draft, 80), 'rise'), '80s');

    const request = toForgeRequest(draft);

    expect(forgeRequestSchema.safeParse(request).success).toBe(true);
    expect(request).toEqual({
      prompt: 'Route de nuit',
      length: { unit: 'minutes', value: 40 },
      discovery: 80,
      decades: ['80s'],
      shape: 'rise',
      locale: 'fr',
    });
  });

  it('joint le résumé des écoutes seulement si l’alliage est activé', () => {
    const taste = makeTaste();

    expect(toForgeRequest(withPrompt(), { taste })).not.toHaveProperty('taste');
    expect(toForgeRequest(setUseTaste(withPrompt(), true), { taste }).taste).toEqual(taste);
    expect(toForgeRequest(setUseTaste(withPrompt(), true))).not.toHaveProperty('taste');
  });

  it('transmet la langue demandée', () => {
    expect(toForgeRequest(withPrompt(), { locale: 'en' }).locale).toBe('en');
  });

  it('refuse un brouillon sans minerai', () => {
    expect(() => toForgeRequest(createDraft())).toThrow('without an ore');
  });
});

describe('draftFrom (moule ou pièce)', () => {
  it('reprend le minerai et tous les réglages', () => {
    const settings = makeForgeSettings({
      length: { unit: 'tracks', value: 12 },
      discovery: 30,
      decades: ['70s', '00s'],
      shape: 'fall',
      useTaste: true,
    });

    expect(draftFrom({ prompt: 'Dimanche matin', settings })).toEqual({
      prompt: 'Dimanche matin',
      settings,
    });
  });

  it('copie les réglages : modifier le brouillon ne touche pas la source', () => {
    const source = { prompt: 'Dimanche matin', settings: makeForgeSettings({ decades: ['70s'] }) };

    const edited = toggleDecade(draftFrom(source), '90s');

    expect(edited.settings.decades).toEqual(['70s', '90s']);
    expect(source.settings.decades).toEqual(['70s']);
    expect(draftFrom(source).settings.decades).not.toBe(source.settings.decades);
  });

  it('recale une source ancienne sur les bornes, les pas et l’ordre actuels', () => {
    const source = {
      prompt: 'Ancien moule',
      settings: makeForgeSettings({
        length: { unit: 'minutes', value: 37 },
        discovery: 45,
        decades: ['90s', '60s'],
      }),
    };

    expect(draftFrom(source).settings).toMatchObject({
      length: { unit: 'minutes', value: 35 },
      discovery: 50,
      decades: ['60s', '90s'],
    });
  });
});
