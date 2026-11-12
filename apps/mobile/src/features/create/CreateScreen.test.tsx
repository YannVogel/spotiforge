import { forgeRequestSchema } from '@spotiforge/shared';
import { makeForgeSettings } from '@spotiforge/shared/testing';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useDraftStore } from '../draft/draft-store';
import { setAlloyAvailability, useAlloyStore } from '../taste/taste-store';
import { CreateScreen } from './CreateScreen';

const draft = () => useDraftStore.getState().draft;

async function renderScreen() {
  const onForge = jest.fn();
  const onOpenPieces = jest.fn();
  await render(<CreateScreen onForge={onForge} onOpenPieces={onOpenPieces} />);
  return { onForge, onOpenPieces };
}

const increment = { nativeEvent: { actionName: 'increment' } };

// Valeur affichée au-dessus d'une barre : masquée aux lecteurs d'écran, qui lisent celle de la barre.
const shownValue = (text: string) => screen.getByText(text, { includeHiddenElements: true });

beforeEach(() => {
  useDraftStore.setState(useDraftStore.getInitialState(), true);
  useAlloyStore.setState(useAlloyStore.getInitialState(), true);
});

it('affiche le titre, le minerai et les réglages de la maquette', async () => {
  await renderScreen();

  expect(screen.getByRole('header', { name: 'Qu’est-ce qu’on forge ?' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Le minerai — ton moment')).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Alliage : mes écoutes' })).toBeOnTheScreen();
  expect(screen.getByRole('adjustable', { name: 'Durée en minutes' })).toBeOnTheScreen();
  expect(
    screen.getByRole('adjustable', { name: 'Part de découverte en pourcentage' }),
  ).toBeOnTheScreen();
  expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  expect(
    screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel ?? ''),
  ).toHaveLength(4);
  expect(shownValue('40 MIN')).toBeOnTheScreen();
  expect(shownValue('50 %')).toBeOnTheScreen();
});

it('enregistre le minerai saisi dans le brouillon', async () => {
  await renderScreen();

  await fireEvent.changeText(screen.getByLabelText('Le minerai — ton moment'), 'Route de nuit');

  expect(draft().prompt).toBe('Route de nuit');
});

it('désactive le bouton « Forger » tant que le minerai est vide', async () => {
  const { onForge } = await renderScreen();
  const button = screen.getByRole('button', { name: 'Forger la playlist' });

  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(onForge).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Le minerai — ton moment'), '   ');
  expect(screen.getByRole('button', { name: 'Forger la playlist' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('Le minerai — ton moment'), 'Pluie');
  expect(screen.getByRole('button', { name: 'Forger la playlist' })).toBeEnabled();
});

it('modifie chaque réglage du brouillon', async () => {
  await renderScreen();

  await fireEvent.press(screen.getByRole('switch', { name: 'Alliage : mes écoutes' }));
  await fireEvent(
    screen.getByRole('adjustable', { name: 'Durée en minutes' }),
    'accessibilityAction',
    increment,
  );
  await fireEvent(
    screen.getByRole('adjustable', { name: 'Part de découverte en pourcentage' }),
    'accessibilityAction',
    increment,
  );
  await fireEvent.press(screen.getByRole('checkbox', { name: '80s' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '00s' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Vague' }));

  expect(draft().settings).toEqual({
    length: { unit: 'minutes', value: 45 },
    discovery: 60,
    decades: ['80s', '00s'],
    shape: 'wave',
    useTaste: true,
  });
  expect(shownValue('45 MIN')).toBeOnTheScreen();
  expect(shownValue('60 %')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: '80s' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Vague' })).toBeChecked();
});

it('affiche une longueur en titres reprise d’un moule', async () => {
  useDraftStore.getState().load({
    prompt: 'Dimanche',
    settings: makeForgeSettings({ length: { unit: 'tracks', value: 12 } }),
  });

  await renderScreen();

  expect(shownValue('12 TITRES')).toBeOnTheScreen();
  expect(screen.getByRole('adjustable', { name: 'Nombre de titres' })).toHaveAccessibilityValue({
    min: 3,
    max: 30,
    now: 12,
  });
});

it('déclenche la forge avec une requête valide tirée du brouillon', async () => {
  const { onForge } = await renderScreen();

  await fireEvent.changeText(screen.getByLabelText('Le minerai — ton moment'), ' Route de nuit ');
  await fireEvent.press(screen.getByRole('radio', { name: 'Montée' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Forger la playlist' }));

  expect(onForge).toHaveBeenCalledTimes(1);
  const request = onForge.mock.calls[0]?.[0];
  expect(forgeRequestSchema.parse(request)).toEqual(request);
  expect(request).toMatchObject({ prompt: 'Route de nuit', shape: 'rise', locale: 'fr' });
});

it('ouvre « Mes pièces »', async () => {
  const { onOpenPieces } = await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Mes pièces' }));

  expect(onOpenPieces).toHaveBeenCalledTimes(1);
});

it('désactive l’alliage avec un message quand Spotify ne donne pas les écoutes', async () => {
  useDraftStore.getState().setUseTaste(true);
  setAlloyAvailability('unavailable');
  await renderScreen();

  const alloy = screen.getByRole('switch', { name: 'Alliage : mes écoutes' });
  expect(alloy).toBeDisabled();
  expect(alloy).not.toBeChecked();
  expect(screen.getByText(/ne donne pas accès à tes écoutes/)).toBeOnTheScreen();
});
