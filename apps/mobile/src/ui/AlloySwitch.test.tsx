import { fireEvent, render, screen } from '@testing-library/react-native';

import { AlloySwitch } from './AlloySwitch';
import { size } from './theme';

const LABEL = 'Alliage : mes écoutes';

it('est un interrupteur nommé qui reflète son état', async () => {
  await render(<AlloySwitch label={LABEL} value onValueChange={jest.fn()} />);

  expect(screen.getByRole('switch', { name: LABEL })).toBeChecked();
});

it('bascule la valeur à chaque appui', async () => {
  const onValueChange = jest.fn();
  await render(<AlloySwitch label={LABEL} value={false} onValueChange={onValueChange} />);

  await fireEvent.press(screen.getByRole('switch', { name: LABEL }));

  expect(onValueChange).toHaveBeenCalledWith(true);
});

it('ne bascule pas quand il est désactivé', async () => {
  const onValueChange = jest.fn();
  await render(<AlloySwitch label={LABEL} value onValueChange={onValueChange} disabled />);
  const toggle = screen.getByRole('switch', { name: LABEL });

  await fireEvent.press(toggle);

  expect(onValueChange).not.toHaveBeenCalled();
  expect(toggle).toBeDisabled();
});

it('fait de toute la ligne une zone tactile d’au moins 44 px', async () => {
  await render(<AlloySwitch label={LABEL} value onValueChange={jest.fn()} />);
  expect(screen.getByRole('switch')).toHaveStyle({ minHeight: size.touchMin });
});
