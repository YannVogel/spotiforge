import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { getAppServices } from '../features/app/services';
import { startPiecePersistence } from '../features/pieces/persistence';
import { getAppConfig } from '../infra/config';
import { colors, useThemeFonts } from '../ui/theme';

// Valide la configuration dès le démarrage : une valeur manquante est signalée tout de suite,
// par son nom, plutôt qu'au premier appel réseau.
getAppConfig();

// Garde l'écran de lancement jusqu'au chargement des polices (appel global, sans attendre,
// comme le recommande la doc d'expo-splash-screen).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const ready = useThemeFonts();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Chaque changement de la pièce sur l'enclume est enregistré sur le téléphone.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let unmounted = false;
    getAppServices()
      .then(({ pieces }) => {
        if (!unmounted) stop = startPiecePersistence(pieces).stop;
      })
      .catch((error: unknown) =>
        console.error(
          'Local pieces could not be opened',
          error instanceof Error ? error.name : 'unknown',
        ),
      );
    return () => {
      unmounted = true;
      stop?.();
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <StatusBar style="light" />
    </>
  );
}
