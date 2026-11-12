import type { Draft } from '../../domain/draft';
import type { Mold, MoldRepository } from '../../domain/history';
import { canSaveAsMold, cleanMoldName, moldFromDraft } from '../../domain/mold';
import { useDraftStore } from '../draft/draft-store';

export class MoldError extends Error {
  override name = 'MoldError';

  constructor(readonly reason: 'empty_name' | 'empty_ore' | 'not_found') {
    super(`Mold operation refused: ${reason}`);
  }
}

type Dependencies = {
  repository: MoldRepository;
  /** Compte connecté : les moules sont cloisonnés par compte. */
  ownerSpotifyId: string;
  now: () => Date;
  newId: () => string;
};

/** Enregistrer, relancer, renommer et supprimer des moules. */
export function createMoldService({ repository, ownerSpotifyId, now, newId }: Dependencies) {
  function requireName(name: string): string {
    const cleaned = cleanMoldName(name);
    if (!cleaned) throw new MoldError('empty_name');
    return cleaned;
  }

  return {
    list(): Promise<Mold[]> {
      return repository.list(ownerSpotifyId);
    },

    /** Enregistre le brouillon courant comme moule, sous le nom donné. */
    async saveDraft(name: string, draft: Draft): Promise<Mold> {
      const cleanedName = requireName(name);
      if (!canSaveAsMold(draft)) throw new MoldError('empty_ore');
      const mold = moldFromDraft(draft, {
        id: newId(),
        ownerSpotifyId,
        name: cleanedName,
        createdAt: now().toISOString(),
      });
      await repository.save(mold);
      return mold;
    },

    /** Charge un moule dans le brouillon de l'écran Création. */
    async loadIntoDraft(id: string): Promise<void> {
      const mold = await repository.findById(ownerSpotifyId, id);
      if (!mold) throw new MoldError('not_found');
      useDraftStore.getState().load(mold);
    },

    async rename(id: string, name: string): Promise<void> {
      await repository.rename(ownerSpotifyId, id, requireName(name));
    },

    async delete(id: string): Promise<void> {
      await repository.delete(ownerSpotifyId, id);
    },
  };
}

export type MoldService = ReturnType<typeof createMoldService>;
