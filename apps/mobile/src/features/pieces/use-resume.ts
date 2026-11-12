import { useCallback, useEffect } from 'react';

import { useAnvilStore } from '../anvil/anvil-store';
import { getAppServices } from '../app/services';
import { useSessionStore } from '../session/session-store';
import { checkSavedPiece, dismissResume, resumeOffer, resumePiece } from './resume';
import { useResumeStore } from './resume-store';

/** La proposition de reprise de l'écran Création, branchée sur la base et la session. */
export function useResume(onResumed: () => void) {
  const session = useSessionStore((store) => store.session);
  const ownerSpotifyId = session.status === 'signedIn' ? session.account.id : null;
  // Ces abonnements font recalculer l'offre quand l'enclume ou la reprise changent.
  useAnvilStore((store) => store.record);
  useResumeStore((store) => store);
  const offer = ownerSpotifyId ? resumeOffer() : null;

  useEffect(() => {
    if (!ownerSpotifyId) return;
    getAppServices()
      .then(({ pieces }) => checkSavedPiece(pieces, ownerSpotifyId))
      .catch((error: unknown) =>
        console.error(
          'Could not look for a saved piece',
          error instanceof Error ? error.name : 'unknown',
        ),
      );
  }, [ownerSpotifyId]);

  const resume = useCallback(async () => {
    if (!offer || !ownerSpotifyId) return;
    const { pieces } = await getAppServices();
    if (await resumePiece(pieces, ownerSpotifyId, offer.id)) onResumed();
  }, [offer, ownerSpotifyId, onResumed]);

  return { offer, resume: () => void resume(), dismiss: dismissResume };
}
