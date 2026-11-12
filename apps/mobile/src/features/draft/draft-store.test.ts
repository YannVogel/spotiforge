import { makeForgeSettings } from '@spotiforge/shared/testing';

import { createDraft } from '../../domain/draft';
import { useDraftStore } from './draft-store';

const store = () => useDraftStore.getState();

beforeEach(() => {
  useDraftStore.setState(useDraftStore.getInitialState(), true);
});

it('démarre sur un brouillon par défaut', () => {
  expect(store().draft).toEqual(createDraft());
});

it('applique chaque réglage par les règles du domaine', () => {
  store().setPrompt('Route de nuit');
  store().setLengthValue(43);
  store().setDiscovery(64);
  store().toggleDecade('80s');
  store().setShape('rise');
  store().setUseTaste(true);

  expect(store().draft).toEqual({
    prompt: 'Route de nuit',
    settings: {
      length: { unit: 'minutes', value: 45 },
      discovery: 60,
      decades: ['80s'],
      shape: 'rise',
      useTaste: true,
    },
  });
});

it('bascule l’unité de longueur', () => {
  store().setLengthUnit('tracks');

  expect(store().draft.settings.length).toEqual({ unit: 'tracks', value: 10 });
});

it('charge un moule sans le lier au brouillon', () => {
  const mold = { prompt: 'Dimanche matin', settings: makeForgeSettings({ decades: ['70s'] }) };

  store().load(mold);
  store().toggleDecade('90s');
  store().setPrompt('Autre chose');

  expect(mold).toEqual({
    prompt: 'Dimanche matin',
    settings: makeForgeSettings({ decades: ['70s'] }),
  });
  expect(store().draft.settings.decades).toEqual(['70s', '90s']);
});

it('se réinitialise', () => {
  store().setPrompt('Route de nuit');
  store().toggleDecade('80s');

  store().reset();

  expect(store().draft).toEqual(createDraft());
});
