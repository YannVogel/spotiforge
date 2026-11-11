import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../app/index';

test("l'écran d'accueil s'affiche", async () => {
  await render(<HomeScreen />);

  expect(screen.getByLabelText('Spotiforge')).toBeOnTheScreen();
});
