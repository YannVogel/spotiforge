import { useCallback } from 'react';

import { ForgeError } from '../../domain/forge';
import type { PieceRecord } from '../../domain/history';
import { getAppServices } from '../app/services';
import { useDraftStore } from '../draft/draft-store';
import { useSessionStore } from '../session/session-store';
import { cancelForge, type ForgeControllerDependencies, startForge } from './forge-controller';
import { useForgeStore } from './forge-store';

/** Dépendances réelles de la forge, pour le compte connecté. */
async function forgeDependencies(): Promise<ForgeControllerDependencies> {
  const services = await getAppServices();
  const { session } = useSessionStore.getState();
  if (session.status !== 'signedIn') throw new ForgeError('unauthorized');
  return { ...services, ownerSpotifyId: session.account.id };
}

/** La forge pour l'écran Création : état, lancement depuis le brouillon courant, annulation. */
export function useForge(onForged: (record: PieceRecord) => void) {
  const state = useForgeStore((store) => store.state);
  const start = useCallback(() => {
    void startForge(useDraftStore.getState().draft, forgeDependencies, onForged);
  }, [onForged]);
  return { state, start, cancel: cancelForge };
}
