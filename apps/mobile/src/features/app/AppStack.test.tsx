import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import { AppStack } from './AppStack';

// Routes simulées : seule la garde de navigation est testée ici.
function routes(signedIn: boolean) {
  return {
    _layout: () => <AppStack signedIn={signedIn} />,
    index: () => <Text>Écran Création</Text>,
    anvil: () => <Text>Écran Enclume</Text>,
    'sign-in': () => <Text>Écran Connexion</Text>,
    // Écrans de démonstration, non protégés : ils ne doivent pas servir de repli.
    components: () => <Text>Démo composants</Text>,
    theme: () => <Text>Démo thème</Text>,
  };
}

it('sans session, seul l’écran de connexion est accessible', async () => {
  await renderRouter(routes(false), { initialUrl: '/' });

  expect(screen.getByText('Écran Connexion')).toBeOnTheScreen();
  expect(screen.queryByText('Écran Création')).toBeNull();
});

it('sans session, un lien direct vers l’enclume mène aussi à la connexion', async () => {
  await renderRouter(routes(false), { initialUrl: '/anvil' });

  expect(screen.getByText('Écran Connexion')).toBeOnTheScreen();
});

it('avec une session, on arrive sur l’écran Création', async () => {
  await renderRouter(routes(true), { initialUrl: '/' });

  expect(screen.getByText('Écran Création')).toBeOnTheScreen();
});

it('avec une session, l’écran de connexion n’est plus accessible', async () => {
  await renderRouter(routes(true), { initialUrl: '/sign-in' });

  expect(screen.getByText('Écran Création')).toBeOnTheScreen();
});
