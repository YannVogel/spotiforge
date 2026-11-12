import type { Draft } from './draft';
import type { Mold } from './history';

export const MOLD_NAME_MAX_LENGTH = 60;

/** Nom de moule nettoyé, ou `null` s'il est vide une fois les espaces retirés. */
export function cleanMoldName(name: string): string | null {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, MOLD_NAME_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** Un moule sans minerai ne servirait à rien. */
export function canSaveAsMold(draft: Draft): boolean {
  return draft.prompt.trim().length > 0;
}

/** Fige le brouillon en moule. Copie : modifier le brouillon ensuite ne touche pas le moule. */
export function moldFromDraft(
  draft: Draft,
  fields: Pick<Mold, 'id' | 'ownerSpotifyId' | 'name' | 'createdAt'>,
): Mold {
  return {
    ...fields,
    prompt: draft.prompt.trim(),
    settings: {
      ...draft.settings,
      length: { ...draft.settings.length },
      decades: [...draft.settings.decades],
    },
  };
}
