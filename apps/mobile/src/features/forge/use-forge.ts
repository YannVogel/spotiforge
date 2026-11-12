import { useCallback } from 'react';

import type { PieceRecord } from '../../domain/history';
import { useDraftStore } from '../draft/draft-store';
import { forgeDependencies } from './dependencies';
import { cancelForge, startForge } from './forge-controller';
import { useForgeStore } from './forge-store';

/** La forge pour l'écran Création : état, lancement depuis le brouillon courant, annulation. */
export function useForge(onForged: (record: PieceRecord) => void) {
  const state = useForgeStore((store) => store.state);
  const start = useCallback(() => {
    void startForge(useDraftStore.getState().draft, forgeDependencies, onForged);
  }, [onForged]);
  return { state, start, cancel: cancelForge };
}
