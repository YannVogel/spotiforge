import { makeForgeSettings } from '@spotiforge/shared/testing';

import { createDraft, type Draft } from '../../domain/draft';
import { migrate } from '../../infra/db/migrations';
import { createMoldRepository } from '../../infra/db/mold-repository';
import { createMemoryDatabase } from '../../infra/db/testing/node-sql-database';
import { useDraftStore } from '../draft/draft-store';
import { createMoldService, MoldError } from './mold-service';

const draft: Draft = {
  prompt: 'Un dimanche matin lent',
  settings: makeForgeSettings({
    length: { unit: 'tracks', value: 12 },
    discovery: 30,
    decades: ['70s', '00s'],
    shape: 'fall',
    useTaste: true,
  }),
};

async function setup() {
  const db = createMemoryDatabase();
  await migrate(db);
  const repository = createMoldRepository(db);
  let ids = 0;
  const serviceFor = (ownerSpotifyId: string) =>
    createMoldService({
      repository,
      ownerSpotifyId,
      now: () => new Date('2026-11-12T01:00:00.000Z'),
      newId: () => `mold-${++ids}`,
    });
  return { repository, molds: serviceFor('owner-a'), other: serviceFor('owner-b') };
}

const storeDraft = () => useDraftStore.getState().draft;

beforeEach(() => {
  useDraftStore.setState(useDraftStore.getInitialState(), true);
});

it('enregistre le brouillon comme moule, sous un nom', async () => {
  const { molds, repository } = await setup();

  const mold = await molds.saveDraft('  Dimanche  ', draft);

  expect(mold).toEqual({
    id: 'mold-1',
    ownerSpotifyId: 'owner-a',
    name: 'Dimanche',
    prompt: draft.prompt,
    settings: draft.settings,
    createdAt: '2026-11-12T01:00:00.000Z',
  });
  expect(await repository.findById('owner-a', 'mold-1')).toEqual(mold);
  expect(await molds.list()).toEqual([mold]);
});

it('charge un moule : le minerai et tous les réglages remplissent le brouillon', async () => {
  const { molds } = await setup();
  const mold = await molds.saveDraft('Dimanche', draft);
  useDraftStore.getState().setPrompt('Autre chose');

  await molds.loadIntoDraft(mold.id);

  expect(storeDraft()).toEqual(draft);
});

it('modifier le brouillon après chargement ne modifie pas le moule', async () => {
  const { molds, repository } = await setup();
  const mold = await molds.saveDraft('Dimanche', draft);
  await molds.loadIntoDraft(mold.id);

  useDraftStore.getState().setPrompt('Tout autre chose');
  useDraftStore.getState().toggleDecade('90s');
  useDraftStore.getState().setDiscovery(90);

  expect(await repository.findById('owner-a', mold.id)).toEqual(mold);
  await molds.loadIntoDraft(mold.id);
  expect(storeDraft()).toEqual(draft);
});

it('renomme puis supprime un moule', async () => {
  const { molds } = await setup();
  const mold = await molds.saveDraft('Dimanche', draft);

  await molds.rename(mold.id, ' Matin   lent ');
  expect((await molds.list())[0]?.name).toBe('Matin lent');

  await molds.delete(mold.id);
  expect(await molds.list()).toEqual([]);
});

describe('refus', () => {
  it('refuse un nom vide, à la création comme au renommage', async () => {
    const { molds } = await setup();

    await expect(molds.saveDraft('   ', draft)).rejects.toThrow(new MoldError('empty_name'));
    const mold = await molds.saveDraft('Dimanche', draft);
    await expect(molds.rename(mold.id, '')).rejects.toThrow(new MoldError('empty_name'));
  });

  it('refuse un moule sans minerai', async () => {
    const { molds } = await setup();

    await expect(molds.saveDraft('Vide', createDraft())).rejects.toThrow(
      new MoldError('empty_ore'),
    );
  });

  it('signale un moule introuvable sans toucher au brouillon', async () => {
    const { molds } = await setup();
    useDraftStore.getState().setPrompt('Brouillon en cours');

    await expect(molds.loadIntoDraft('absent')).rejects.toThrow(new MoldError('not_found'));
    expect(storeDraft().prompt).toBe('Brouillon en cours');
  });

  it('ne montre ni ne charge les moules d’un autre compte', async () => {
    const { molds, other } = await setup();
    const mold = await molds.saveDraft('Dimanche', draft);

    expect(await other.list()).toEqual([]);
    await expect(other.loadIntoDraft(mold.id)).rejects.toThrow(new MoldError('not_found'));
    await other.delete(mold.id);
    expect(await molds.list()).toHaveLength(1);
  });
});
