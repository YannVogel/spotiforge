import { create } from 'zustand';

import type { PieceSummary } from '../../domain/history';

type ResumeStore = {
  /** Dernière pièce non envoyée trouvée sur le téléphone au lancement. */
  saved: PieceSummary | null;
  /** La recherche du lancement a eu lieu (elle ne se refait pas à chaque passage). */
  checked: boolean;
  /** La personne a écarté la proposition : plus rien jusqu'au prochain lancement. */
  dismissed: boolean;
};

export const useResumeStore = create<ResumeStore>()(() => ({
  saved: null,
  checked: false,
  dismissed: false,
}));
