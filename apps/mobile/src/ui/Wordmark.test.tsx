import { render, screen } from '@testing-library/react-native';

import { Wordmark } from './Wordmark';

it('affiche le nom en capitales et le fait lire normalement', async () => {
  await render(<Wordmark />);

  expect(screen.getByText('SPOTIFORGE')).toBeOnTheScreen();
  expect(screen.getByLabelText('Spotiforge')).toBeOnTheScreen();
});
