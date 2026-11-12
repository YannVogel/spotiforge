import { render, screen } from '@testing-library/react-native';

import { Text } from './Text';
import { colors, textStyles } from './theme';

describe('Text', () => {
  it('applique le style courant et la couleur de texte par défaut', async () => {
    await render(<Text>Le minerai</Text>);

    expect(screen.getByText('Le minerai')).toHaveStyle({
      ...textStyles.body,
      color: colors.text,
    });
  });

  it('applique le style nommé et la couleur demandés', async () => {
    await render(
      <Text variant="cta" color="onEmber">
        Forger la playlist
      </Text>,
    );

    expect(screen.getByText('Forger la playlist')).toHaveStyle({
      fontFamily: 'BigShouldersDisplay-Black',
      fontSize: 32,
      textTransform: 'uppercase',
      color: colors.onEmber,
    });
  });

  it('transmet les propriétés d’accessibilité', async () => {
    await render(<Text accessibilityRole="header">Sur l’enclume</Text>);

    expect(screen.getByRole('header', { name: 'Sur l’enclume' })).toBeOnTheScreen();
  });
});
