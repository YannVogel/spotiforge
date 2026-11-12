import { create } from 'zustand';

/**
 * L'alliage est-il possible ? `unavailable` : Spotify n'a donné aucune écoute à la dernière forge.
 * Gardé en mémoire seulement : au prochain lancement, on réessaie.
 */
export type AlloyAvailability = 'unknown' | 'available' | 'unavailable';

export const useAlloyStore = create<{ availability: AlloyAvailability }>()(() => ({
  availability: 'unknown',
}));

export function setAlloyAvailability(availability: AlloyAvailability): void {
  useAlloyStore.setState({ availability });
}
