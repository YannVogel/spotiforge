import { Stack } from 'expo-router';

import { colors } from '../../ui/theme';

type AppStackProps = {
  /** Session ouverte : sans elle, seul l'écran de connexion est accessible. */
  signedIn: boolean;
};

/**
 * Navigation de l'app, gardée par la session : sans session, Création et enclume sont
 * inaccessibles (même par lien direct) et l'on arrive sur la connexion ; dès que la session
 * s'ouvre, on arrive sur Création.
 */
export function AppStack({ signedIn }: AppStackProps) {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* `redirectTo` : sans lui, le routeur ouvrirait le premier écran libre (démonstrations). */}
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        <Stack.Screen name="index" />
        <Stack.Screen name="anvil" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
