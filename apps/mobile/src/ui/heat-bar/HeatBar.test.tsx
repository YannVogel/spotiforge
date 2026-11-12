import { fireEvent, render, screen } from '@testing-library/react-native';

import { glows, gradients, size } from '../theme';
import { HeatBar } from './HeatBar';

const LABEL = 'Durée en minutes';

async function renderBar(value: number, onChange = jest.fn()) {
  await render(
    <HeatBar
      min={10}
      max={120}
      step={5}
      value={value}
      onChange={onChange}
      accessibilityLabel={LABEL}
      accessibilityValueText={`${value} minutes`}
    />,
  );
  const bar = screen.getByRole('adjustable', { name: LABEL });
  await fireEvent(bar, 'layout', { nativeEvent: { layout: { width: 300, height: 44 } } });
  return { bar, onChange };
}

const touch = (locationX: number) => ({ nativeEvent: { locationX } });

it('expose la valeur et ses bornes aux lecteurs d’écran', async () => {
  const { bar } = await renderBar(40);

  expect(bar).toHaveAccessibilityValue({ min: 10, max: 120, now: 40, text: '40 minutes' });
});

it('règle la valeur par un appui direct sur la barre', async () => {
  const { bar, onChange } = await renderBar(40);

  await fireEvent(bar, 'responderGrant', touch(300));

  expect(onChange).toHaveBeenCalledWith(120);
});

it('suit le glissement, au pas près, sans répéter une valeur', async () => {
  const { bar, onChange } = await renderBar(40);

  await fireEvent(bar, 'responderGrant', touch(81));
  await fireEvent(bar, 'responderMove', touch(150));
  await fireEvent(bar, 'responderMove', touch(151));
  await fireEvent(bar, 'responderMove', touch(-20));

  expect(onChange.mock.calls).toEqual([[65], [10]]);
});

it('monte et descend d’un pas avec les actions d’accessibilité', async () => {
  const { bar, onChange } = await renderBar(40);

  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

  expect(onChange.mock.calls).toEqual([[45], [35]]);
});

it('ne dépasse pas les bornes avec les actions d’accessibilité', async () => {
  const { bar, onChange } = await renderBar(120);

  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

  expect(onChange).not.toHaveBeenCalled();
});

it('remplit la barre au prorata, avec le dégradé et la lueur', async () => {
  await renderBar(65);

  expect(screen.getByTestId('heat-bar-fill')).toHaveStyle({
    width: '50%',
    backgroundImage: gradients.heatBar,
    boxShadow: glows.heatBar.boxShadow,
  });
});

it('n’affiche pas de remplissage au minimum', async () => {
  await renderBar(10);

  expect(screen.queryByTestId('heat-bar-fill')).toBeNull();
});

it('offre une zone tactile de 44 px de haut autour d’une barre de 18 px', async () => {
  const { bar } = await renderBar(40);

  expect(bar).toHaveStyle({ height: size.touchMin });
  expect(screen.getByTestId('heat-bar-fill').parent).toHaveStyle({ height: size.heatBarHeight });
});
