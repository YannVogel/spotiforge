import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppErrorScreen } from './AppErrorScreen';

it('dit ce qui se passe, rassure sur les données et permet de réessayer', async () => {
  const onRetry = jest.fn();
  await render(<AppErrorScreen onRetry={onRetry} />);

  expect(screen.getByRole('alert')).toHaveTextContent(/gardés sur le téléphone/);
  await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
