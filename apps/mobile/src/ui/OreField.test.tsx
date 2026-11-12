import { fireEvent, render, screen } from '@testing-library/react-native';

import { OreField } from './OreField';
import { colors } from './theme';

const LABEL = 'Le minerai — ton moment';

it('affiche le libellé et la valeur, et nomme le champ', async () => {
  await render(<OreField label={LABEL} value="Route de nuit" onChangeText={jest.fn()} />);

  // Le libellé visible est masqué aux lecteurs d'écran : le champ porte déjà ce nom.
  expect(screen.getByText(LABEL, { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByLabelText(LABEL)).toHaveDisplayValue('Route de nuit');
});

it('transmet la saisie', async () => {
  const onChangeText = jest.fn();
  await render(<OreField label={LABEL} value="" onChangeText={onChangeText} />);

  await fireEvent.changeText(screen.getByLabelText(LABEL), 'Pluie sur la ville');

  expect(onChangeText).toHaveBeenCalledWith('Pluie sur la ville');
});

it('passe la bordure en ember pendant la saisie', async () => {
  await render(<OreField label={LABEL} value="" onChangeText={jest.fn()} />);
  const input = screen.getByLabelText(LABEL);
  const box = input.parent;

  await fireEvent(input, 'focus');
  expect(box).toHaveStyle({ borderColor: colors.ember });

  await fireEvent(input, 'blur');
  expect(box).toHaveStyle({ borderColor: colors.borderWarm });
});

it('respecte la limite de longueur et le mode lecture seule', async () => {
  await render(
    <OreField label={LABEL} value="" onChangeText={jest.fn()} maxLength={500} editable={false} />,
  );

  expect(screen.getByLabelText(LABEL)).toHaveProp('maxLength', 500);
  expect(screen.getByLabelText(LABEL)).toHaveProp('editable', false);
});
