import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { getAppConfig } from '../infra/config';

// Valide la configuration dès le démarrage : une valeur manquante est signalée tout de suite,
// par son nom, plutôt qu'au premier appel réseau.
getAppConfig();

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </>
  );
}
