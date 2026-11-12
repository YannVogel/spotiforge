import { type Draft, toForgeRequest } from '../../domain/draft';
import { loadTaste, type TasteResult } from '../../domain/taste';
import { setAlloyAvailability } from './taste-store';

type Dependencies = Parameters<typeof loadTaste>[0];

/**
 * Résumé des écoutes pour une forge : lu même quand l'alliage est désactivé, car il sert aussi à
 * marquer les titres « connus » (#33). L'écran Création apprend ainsi si l'alliage est possible.
 */
export async function loadTasteForForge(dependencies: Dependencies): Promise<TasteResult> {
  const result = await loadTaste(dependencies);
  setAlloyAvailability(result.status === 'ready' ? 'available' : 'unavailable');
  return result;
}

/** La requête de forge : `taste` n'y figure que si l'alliage est activé et le résumé disponible. */
export function forgeRequestWithTaste(draft: Draft, taste: TasteResult) {
  return toForgeRequest(draft, taste.status === 'ready' ? { taste: taste.taste } : {});
}
