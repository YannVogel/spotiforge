import { fireEvent, render, screen } from '@testing-library/react-native';

import { QuenchButton } from './QuenchButton';
import { TrackRow } from './TrackRow';

describe('QuenchButton', () => {
  it('à chaud : « Tremper », lu « Tremper Nightcall »', async () => {
    const onPress = jest.fn();
    await render(<QuenchButton quenched={false} trackTitle="Nightcall" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Tremper Nightcall' });
    expect(screen.getByText('TREMPER')).toBeOnTheScreen();
    expect(button).not.toBeSelected();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('trempé : « Trempé », lu « Remettre au feu Nightcall »', async () => {
    await render(<QuenchButton quenched trackTitle="Nightcall" onPress={() => {}} />);

    expect(screen.getByRole('button', { name: 'Remettre au feu Nightcall' })).toBeSelected();
    expect(screen.getByText('TREMPÉ')).toBeOnTheScreen();
  });

  it('désactivé, il ne répond pas', async () => {
    const onPress = jest.fn();
    await render(
      <QuenchButton quenched={false} trackTitle="Nightcall" onPress={onPress} disabled />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Tremper Nightcall' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TrackRow', () => {
  const props = {
    number: 4,
    title: 'Nightcall',
    meta: 'Kavinsky · 2010 · connu',
    reason: 'La référence de la conduite nocturne.',
  };

  it('affiche le numéro, le titre, les métadonnées et la raison', async () => {
    await render(<TrackRow {...props} quenched={false} onToggleQuench={() => {}} />);

    expect(screen.getByText('Nightcall')).toBeOnTheScreen();
    expect(screen.getByText('Kavinsky · 2010 · connu')).toBeOnTheScreen();
    expect(screen.getByText('La référence de la conduite nocturne.')).toBeOnTheScreen();
    // Le numéro est décoratif pour les lecteurs d'écran : l'ordre de lecture suffit.
    expect(screen.getByText('4', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('bascule la trempe par son bouton', async () => {
    const onToggleQuench = jest.fn();
    await render(<TrackRow {...props} quenched={false} onToggleQuench={onToggleQuench} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tremper Nightcall' }));
    expect(onToggleQuench).toHaveBeenCalledTimes(1);
  });

  it('ouvre le titre par un appui sur son texte, quand c’est prévu', async () => {
    const onPress = jest.fn();
    await render(
      <TrackRow
        {...props}
        quenched
        onToggleQuench={() => {}}
        onPress={onPress}
        pressLabel="Écouter Nightcall dans Spotify"
      />,
    );

    await fireEvent.press(screen.getByRole('link', { name: 'Écouter Nightcall dans Spotify' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
