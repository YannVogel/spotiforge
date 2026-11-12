import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { PieceRecord } from '../domain/history';
import { useAnvilStore } from '../features/anvil/anvil-store';
import { signOut } from '../features/auth/dependencies';
import { CreateScreen } from '../features/create/CreateScreen';
import { useForge } from '../features/forge/use-forge';
import { useResumeStore } from '../features/pieces/resume-store';
import { useResume } from '../features/pieces/use-resume';
import { useSessionStore } from '../features/session/session-store';

/** Premier écran : la création. Une forge réussie pose la pièce sur l'enclume. */
export default function CreateRoute() {
  const router = useRouter();
  const onForged = useCallback(
    (record: PieceRecord) => {
      useAnvilStore.getState().open(record);
      // Une nouvelle pièce : la proposition de reprise vaut de nouveau pour elle.
      useResumeStore.setState({ dismissed: false });
      router.push('/anvil');
    },
    [router],
  );
  const forge = useForge(onForged);
  const openAnvil = useCallback(() => router.push('/anvil'), [router]);
  const resume = useResume(openAnvil);
  const session = useSessionStore((store) => store.session);
  const accountName = session.status === 'signedIn' ? session.account.displayName : null;

  return (
    <CreateScreen
      forge={forge.state}
      resume={resume.offer}
      onResume={resume.resume}
      onDismissResume={resume.dismiss}
      onForge={forge.start}
      onCancelForge={forge.cancel}
      // Branché par l'écran « Mes pièces » (#43).
      onOpenPieces={() => {}}
      accountName={accountName}
      onSignOut={() =>
        void signOut().catch((error: unknown) =>
          console.error('Sign-out failed', error instanceof Error ? error.name : 'unknown'),
        )
      }
    />
  );
}
