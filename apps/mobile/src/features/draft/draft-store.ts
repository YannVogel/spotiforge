import type { Decade, LengthUnit, Shape } from '@spotiforge/shared';
import { create } from 'zustand';

import * as rules from '../../domain/draft';
import type { Draft, DraftSource } from '../../domain/draft';

type DraftStore = {
  draft: Draft;
  setPrompt: (prompt: string) => void;
  setLengthValue: (value: number) => void;
  setLengthUnit: (unit: LengthUnit) => void;
  setDiscovery: (value: number) => void;
  toggleDecade: (decade: Decade) => void;
  setShape: (shape: Shape) => void;
  setUseTaste: (useTaste: boolean) => void;
  /** Reprend un moule ou une pièce existante. */
  load: (source: DraftSource) => void;
  reset: () => void;
};

/** Le brouillon en cours, partagé par l'écran Création et l'aperçu. Les règles vivent dans le domaine. */
export const useDraftStore = create<DraftStore>()((set) => {
  const update = (change: (draft: Draft) => Draft) =>
    set(({ draft }) => ({ draft: change(draft) }));
  return {
    draft: rules.createDraft(),
    setPrompt: (prompt) => update((draft) => rules.setPrompt(draft, prompt)),
    setLengthValue: (value) => update((draft) => rules.setLengthValue(draft, value)),
    setLengthUnit: (unit) => update((draft) => rules.setLengthUnit(draft, unit)),
    setDiscovery: (value) => update((draft) => rules.setDiscovery(draft, value)),
    toggleDecade: (decade) => update((draft) => rules.toggleDecade(draft, decade)),
    setShape: (shape) => update((draft) => rules.setShape(draft, shape)),
    setUseTaste: (useTaste) => update((draft) => rules.setUseTaste(draft, useTaste)),
    load: (source) => set({ draft: rules.draftFrom(source) }),
    reset: () => set({ draft: rules.createDraft() }),
  };
});
