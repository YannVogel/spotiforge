import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from './Chip';
import { SegmentButton } from './SegmentButton';
import { colors, size } from './theme';

describe('Chip', () => {
  it('est une case à cocher qui reflète sa sélection', async () => {
    await render(<Chip label="80s" selected onPress={jest.fn()} />);

    const chip = screen.getByRole('checkbox', { name: '80s' });
    expect(chip).toBeChecked();
    expect(chip).toHaveStyle({ backgroundColor: colors.ember });
  });

  it('déclenche son action, sauf désactivé', async () => {
    const onPress = jest.fn();
    await render(<Chip label="90s" selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: '90s' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await screen.rerender(<Chip label="90s" selected={false} onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('checkbox', { name: '90s' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('accepte un libellé d’accessibilité plus parlant', async () => {
    await render(
      <Chip label="80s" accessibilityLabel="Années 80" selected={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Années 80' })).not.toBeChecked();
  });

  it('offre une zone tactile d’au moins 44 × 44 px', async () => {
    await render(<Chip label="60s" selected={false} onPress={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toHaveStyle({
      minHeight: size.touchMin,
      minWidth: size.touchMin,
    });
  });
});

describe('SegmentButton', () => {
  it('est un bouton radio : sélectionné, bordure flame', async () => {
    await render(<SegmentButton label="Montée" selected onPress={jest.fn()} />);

    const segment = screen.getByRole('radio', { name: 'Montée' });
    expect(segment).toBeChecked();
    expect(segment).toHaveStyle({ borderColor: colors.flame });
  });

  it('déclenche son action, sauf désactivé', async () => {
    const onPress = jest.fn();
    await render(<SegmentButton label="Vague" selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Vague' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <SegmentButton label="Vague" selected={false} onPress={onPress} disabled />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Vague' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio')).toBeDisabled();
  });

  it('offre une zone tactile d’au moins 44 px', async () => {
    await render(<SegmentButton label="Libre" selected={false} onPress={jest.fn()} />);
    expect(size.segmentHeight).toBeGreaterThanOrEqual(size.touchMin);
    expect(screen.getByRole('radio')).toHaveStyle({ minHeight: size.segmentHeight });
  });
});
