import { createDraft, setPrompt, toggleDecade } from './draft';
import { canSaveAsMold, cleanMoldName, MOLD_NAME_MAX_LENGTH, moldFromDraft } from './mold';

describe('cleanMoldName', () => {
  it.each([
    ['  Dimanche   matin ', 'Dimanche matin'],
    ['   ', null],
    ['', null],
  ])('%j → %j', (name, expected) => {
    expect(cleanMoldName(name)).toBe(expected);
  });

  it('coupe un nom trop long', () => {
    expect(cleanMoldName('a'.repeat(MOLD_NAME_MAX_LENGTH + 10))).toHaveLength(MOLD_NAME_MAX_LENGTH);
  });
});

it('n’accepte un moule qu’avec un minerai', () => {
  expect(canSaveAsMold(createDraft())).toBe(false);
  expect(canSaveAsMold(setPrompt(createDraft(), '  '))).toBe(false);
  expect(canSaveAsMold(setPrompt(createDraft(), 'Pluie'))).toBe(true);
});

it('fige le brouillon : le modifier ensuite ne touche pas le moule', () => {
  const draft = toggleDecade(setPrompt(createDraft(), ' Dimanche matin '), '70s');
  const fields = {
    id: 'm1',
    ownerSpotifyId: 'owner-a',
    name: 'Dimanche',
    createdAt: '2026-11-12T00:00:00.000Z',
  };

  const mold = moldFromDraft(draft, fields);
  const edited = toggleDecade(draft, '90s');

  expect(mold).toEqual({ ...fields, prompt: 'Dimanche matin', settings: draft.settings });
  expect(edited.settings.decades).toEqual(['70s', '90s']);
  expect(mold.settings.decades).toEqual(['70s']);
  expect(mold.settings.decades).not.toBe(draft.settings.decades);
});
