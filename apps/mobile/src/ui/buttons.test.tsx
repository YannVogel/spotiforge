import { fireEvent, render, screen } from '@testing-library/react-native';

import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { colors, glows, size } from './theme';

describe.each([
  ['PrimaryButton', PrimaryButton, size.ctaHeight],
  ['SecondaryButton', SecondaryButton, size.secondaryHeight],
])('%s', (_name, Button, minHeight) => {
  it('déclenche son action', async () => {
    const onPress = jest.fn();
    await render(<Button label="Forger la playlist" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Forger la playlist' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien quand il est désactivé, et le dit', async () => {
    const onPress = jest.fn();
    await render(<Button label="Forger la playlist" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Forger la playlist' });

    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('pendant le chargement, affiche le libellé dédié et ignore les appuis', async () => {
    const onPress = jest.fn();
    await render(
      <Button label="Reforger" loadingLabel="Forge en cours" onPress={onPress} loading />,
    );
    const button = screen.getByRole('button', { name: 'Forge en cours' });

    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('utilise le libellé d’accessibilité fourni', async () => {
    await render(
      <Button label="Reforger 5" accessibilityLabel="Reforger 5 titres" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Reforger 5 titres' })).toBeOnTheScreen();
  });

  it('offre une zone tactile d’au moins 44 px de haut', async () => {
    await render(<Button label="Reforger" onPress={jest.fn()} />);

    expect(minHeight).toBeGreaterThanOrEqual(size.touchMin);
    expect(screen.getByRole('button')).toHaveStyle({ minHeight });
  });
});

describe('halo', () => {
  it('appartient au seul bouton principal actif', async () => {
    await render(<PrimaryButton label="Forger" onPress={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: colors.ember,
      boxShadow: glows.cta.boxShadow,
    });
  });

  it("s'éteint quand le bouton principal est désactivé", async () => {
    await render(<PrimaryButton label="Forger" onPress={jest.fn()} disabled />);
    expect(screen.getByRole('button')).not.toHaveStyle({ boxShadow: glows.cta.boxShadow });
  });

  it('ne touche pas le bouton secondaire', async () => {
    await render(<SecondaryButton label="Reforger" onPress={jest.fn()} />);
    expect(screen.getByRole('button')).not.toHaveStyle({ boxShadow: glows.cta.boxShadow });
  });
});
