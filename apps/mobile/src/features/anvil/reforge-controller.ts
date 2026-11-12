import { forgeFailureOf } from '../forge/failure';
import type { ForgeControllerDependencies } from '../forge/forge-controller';
import { runReforge } from '../forge/forge-run';
import { useAnvilStore } from './anvil-store';

/**
 * Reforge la pièce sur l'enclume. Un second appui pendant la reforge est ignoré. En cas d'échec, la
 * pièce reste telle quelle et l'échec est affiché ; la personne peut réessayer.
 */
export async function startReforge(
  getDependencies: () => Promise<ForgeControllerDependencies>,
): Promise<void> {
  const { record, reforge } = useAnvilStore.getState();
  if (!record || reforge.status === 'reforging') return;
  useAnvilStore.setState({ reforge: { status: 'reforging' } });

  try {
    const reforged = await runReforge(record, await getDependencies());
    // La pièce a pu être fermée ou remplacée entre-temps : on ne pose le résultat que sur elle.
    if (useAnvilStore.getState().record?.id !== record.id) return;
    useAnvilStore.setState({ record: reforged, reforge: { status: 'idle' } });
  } catch (error) {
    if (useAnvilStore.getState().record?.id !== record.id) return;
    useAnvilStore.setState({ reforge: { status: 'failed', failure: forgeFailureOf(error) } });
  }
}
