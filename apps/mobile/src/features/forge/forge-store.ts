import { create } from 'zustand';

import type { ForgeFailure } from './failure';
import type { ForgeProgress } from './forge-run';

export type ForgeState =
  | { status: 'idle' }
  | { status: 'forging'; progress: ForgeProgress }
  | { status: 'failed'; failure: ForgeFailure };

type ForgeStore = {
  state: ForgeState;
  /** Annule la forge en cours ; absent hors forge. */
  abort: AbortController | null;
};

/** État de la forge lancée depuis l'écran Création. */
export const useForgeStore = create<ForgeStore>()(() => ({
  state: { status: 'idle' },
  abort: null,
}));
