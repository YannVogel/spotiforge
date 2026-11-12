import { create } from 'zustand';

import type { Account } from '../../domain/session';

export type SessionState =
  | { status: 'restoring' }
  | { status: 'signedIn'; account: Account }
  /** `expired` : Spotify a refusé de renouveler la session ; `forbidden` : compte non autorisé. */
  | { status: 'signedOut'; reason: 'signedOut' | 'expired' | 'forbidden' | null };

/** État de la session, lu par les écrans (garde de navigation, en-tête). */
export const useSessionStore = create<{ session: SessionState }>()(() => ({
  session: { status: 'restoring' },
}));

export function setSession(session: SessionState): void {
  useSessionStore.setState({ session });
}
