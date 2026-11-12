import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppErrorScreen } from '../features/app/AppErrorScreen';
import { AppStack } from '../features/app/AppStack';
import { getAppServices } from '../features/app/services';
import { startPiecePersistence } from '../features/pieces/persistence';
import { watchAccountChanges } from '../features/session/account-scope';
import { setSession, useSessionStore } from '../features/session/session-store';
import { getAppConfig } from '../infra/config';
import { useThemeFonts } from '../ui/theme';

// Valide la configuration dès le démarrage : une valeur manquante est signalée tout de suite,
// par son nom, plutôt qu'au premier appel réseau.
getAppConfig();

// Garde l'écran de lancement jusqu'au chargement des polices et de la session (appel global,
// sans attendre, comme le recommande la doc d'expo-splash-screen).
void SplashScreen.preventAutoHideAsync();

/** Barrière d'erreur globale (Expo Router) : un écran pour repartir plutôt qu'un écran blanc. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // Le nom de l'erreur seulement : son message peut citer des données de la personne.
    console.error('Unexpected render error', error.name);
  }, [error]);
  return <AppErrorScreen onRetry={() => void retry()} />;
}

export default function RootLayout() {
  const fontsReady = useThemeFonts();
  const session = useSessionStore((store) => store.session);
  const ready = fontsReady && session.status !== 'restoring';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Un autre compte ne voit jamais ce que le précédent avait en mémoire.
  useEffect(() => watchAccountChanges(), []);

  // Ouvre les services (la session gardée est reprise au passage) ; chaque changement de la pièce
  // sur l'enclume est ensuite enregistré sur le téléphone.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let unmounted = false;
    getAppServices()
      .then(({ pieces }) => {
        if (!unmounted) stop = startPiecePersistence(pieces).stop;
      })
      .catch((error: unknown) => {
        console.error(
          'App services could not be opened',
          error instanceof Error ? error.name : 'unknown',
        );
        // Sans services, pas de session reprise : l'écran de connexion permet de réessayer.
        setSession({ status: 'signedOut', reason: null });
      });
    return () => {
      unmounted = true;
      stop?.();
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <AppStack signedIn={session.status === 'signedIn'} />
      <StatusBar style="light" />
    </>
  );
}
