import type { Draft } from '../../domain/draft';
import { ForgeCancelledError } from '../../domain/forge';
import type { PieceRecord } from '../../domain/history';
import { forgeFailureOf } from './failure';
import { type ForgeRunDependencies, runForge } from './forge-run';
import { useForgeStore } from './forge-store';

export type ForgeControllerDependencies = Omit<ForgeRunDependencies, 'onProgress' | 'signal'>;

/**
 * Lance une forge depuis le brouillon. Un second appui pendant la forge est ignoré ; une annulation
 * ramène à l'état de repos sans message. `onForged` reçoit la pièce, jamais après une annulation.
 */
export async function startForge(
  draft: Draft,
  getDependencies: () => Promise<ForgeControllerDependencies>,
  onForged: (record: PieceRecord) => void,
): Promise<void> {
  if (useForgeStore.getState().state.status === 'forging') return;
  const abort = new AbortController();
  const isCurrent = () => useForgeStore.getState().abort === abort && !abort.signal.aborted;
  useForgeStore.setState({ state: { status: 'forging', progress: { stage: 'listening' } }, abort });

  try {
    const record = await runForge(draft, {
      ...(await getDependencies()),
      signal: abort.signal,
      onProgress: (progress) => {
        if (isCurrent()) useForgeStore.setState({ state: { status: 'forging', progress } });
      },
    });
    if (!isCurrent()) return;
    useForgeStore.setState({ state: { status: 'idle' }, abort: null });
    onForged(record);
  } catch (error) {
    if (!isCurrent() || error instanceof ForgeCancelledError) return;
    useForgeStore.setState({
      state: { status: 'failed', failure: forgeFailureOf(error) },
      abort: null,
    });
  }
}

/** Annule la forge en cours : retour à l'écran Création, brouillon intact. */
export function cancelForge(): void {
  useForgeStore.getState().abort?.abort();
  useForgeStore.setState({ state: { status: 'idle' }, abort: null });
}
