import { fireEvent, render, screen } from '@testing-library/react-native';

import { makePieceTrack } from '../../domain/test-fixtures';
import { makePieceRecord } from '../../infra/db/fixtures';
import { useAnvilStore } from './anvil-store';
import { AnvilScreen } from './AnvilScreen';

// L'écran branché sur le vrai store, comme dans la route.
function ConnectedAnvil(props: { onReforge?: () => void; onSend?: () => void }) {
  const record = useAnvilStore((state) => state.record);
  const reforge = useAnvilStore((state) => state.reforge);
  const toggleQuench = useAnvilStore((state) => state.toggleQuench);
  if (!record) return null;
  return (
    <AnvilScreen
      record={record}
      reforge={reforge}
      onToggleQuench={toggleQuench}
      onBack={() => {}}
      onReforge={props.onReforge ?? (() => {})}
      onSend={props.onSend ?? (() => {})}
    />
  );
}

const record = makePieceRecord({
  title: 'Bord de mer, 2 h du matin',
  description: 'Synthés mélancoliques pour rouler de nuit.',
  tracks: [
    makePieceTrack(1, {
      title: 'Tick of the Clock',
      artist: 'Chromatics',
      year: 2007,
      known: false,
    }),
    makePieceTrack(2, {
      title: 'Nightcall',
      artist: 'Kavinsky',
      year: 2010,
      known: true,
      quenched: true,
    }),
    makePieceTrack(3, { title: 'Under Your Spell', artist: 'Desire', year: 2009, known: false }),
  ],
});

beforeEach(() => {
  useAnvilStore.setState({ record, reforge: { status: 'idle' } });
});

it('affiche le titre, la description, la légende et chaque titre de la pièce', async () => {
  await render(<ConnectedAnvil />);

  expect(screen.getByRole('header', { name: 'Bord de mer, 2 h du matin' })).toBeOnTheScreen();
  expect(screen.getByText('Synthés mélancoliques pour rouler de nuit.')).toBeOnTheScreen();
  expect(screen.getByText('SUR L’ENCLUME')).toBeOnTheScreen();
  expect(screen.getByText('Chromatics · 2007 · découverte')).toBeOnTheScreen();
  expect(screen.getByText('Kavinsky · 2010 · connu')).toBeOnTheScreen();
  expect(screen.getByText('1 TREMPÉ')).toBeOnTheScreen();
});

it('tremper un titre change son bouton, le compteur et le bouton de reforge', async () => {
  await render(<ConnectedAnvil />);
  expect(screen.getByRole('button', { name: 'Reforger 2 titres' })).toBeEnabled();

  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Tick of the Clock' }));

  expect(screen.getByRole('button', { name: 'Remettre au feu Tick of the Clock' })).toBeSelected();
  expect(screen.getByText('2 TREMPÉS')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Reforger 1 titre' })).toBeOnTheScreen();
  expect(useAnvilStore.getState().record?.tracks[0]?.quenched).toBe(true);
});

it('remettre au feu un titre trempé le rend de nouveau remplaçable', async () => {
  await render(<ConnectedAnvil />);

  await fireEvent.press(screen.getByRole('button', { name: 'Remettre au feu Nightcall' }));

  expect(screen.getByRole('button', { name: 'Tremper Nightcall' })).not.toBeSelected();
  expect(screen.getByText('0 TREMPÉ')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Reforger 3 titres' })).toBeOnTheScreen();
});

it('désactive la reforge quand tout est trempé', async () => {
  const onReforge = jest.fn();
  await render(<ConnectedAnvil onReforge={onReforge} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Tick of the Clock' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Under Your Spell' }));

  const reforge = screen.getByRole('button', { name: 'Tout est trempé' });
  expect(reforge).toBeDisabled();
  await fireEvent.press(reforge);
  expect(onReforge).not.toHaveBeenCalled();
});

it('déclenche la reforge et l’envoi', async () => {
  const onReforge = jest.fn();
  const onSend = jest.fn();
  await render(<ConnectedAnvil onReforge={onReforge} onSend={onSend} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Reforger 2 titres' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Envoyer sur Spotify' }));

  expect(onReforge).toHaveBeenCalledTimes(1);
  expect(onSend).toHaveBeenCalledTimes(1);
});

it('lit l’état de chaque titre sans la couleur, par le texte du bouton', async () => {
  await render(<ConnectedAnvil />);

  expect(screen.getAllByText('TREMPER')).toHaveLength(2);
  expect(screen.getAllByText('TREMPÉ')).toHaveLength(1);
});

describe('reforge en cours', () => {
  beforeEach(() => {
    useAnvilStore.setState({ reforge: { status: 'reforging' } });
  });

  it('garde l’écran : les trempés restent, les titres à chaud passent en attente', async () => {
    await render(<ConnectedAnvil />);

    expect(screen.getByText('Nightcall')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tremper Tick of the Clock' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remettre au feu Nightcall' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reforge en cours…' })).toBeBusy();
  });

  it('n’envoie pas pendant la reforge', async () => {
    const onSend = jest.fn();
    await render(<ConnectedAnvil onSend={onSend} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer sur Spotify' }));

    expect(onSend).not.toHaveBeenCalled();
  });
});

it('après un échec de reforge, dit ce qui se passe et laisse réessayer', async () => {
  const onReforge = jest.fn();
  useAnvilStore.setState({ reforge: { status: 'failed', failure: { kind: 'offline' } } });
  await render(<ConnectedAnvil onReforge={onReforge} />);

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Pas de connexion internet. Vérifie ton réseau, puis réessaie.',
  );
  expect(screen.getByText('Tick of the Clock')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Reforger 2 titres' }));
  expect(onReforge).toHaveBeenCalledTimes(1);
});
