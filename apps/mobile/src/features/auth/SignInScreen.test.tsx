import { fireEvent, render, screen } from '@testing-library/react-native';

import { signedOutText, signInFailureText } from './copy';
import { SignInScreen } from './SignInScreen';

it('propose une seule action : se connecter avec Spotify', async () => {
  const onSignIn = jest.fn();
  await render(
    <SignInScreen signingIn={false} offline={false} message={null} onSignIn={onSignIn} />,
  );

  expect(screen.getByRole('header', { name: 'Allume la forge' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Se connecter avec Spotify' }));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('pendant la connexion, le bouton est occupé', async () => {
  const onSignIn = jest.fn();
  await render(<SignInScreen signingIn offline={false} message={null} onSignIn={onSignIn} />);

  const button = screen.getByRole('button', { name: 'Connexion…' });
  expect(button).toBeBusy();
  await fireEvent.press(button);
  expect(onSignIn).not.toHaveBeenCalled();
});

it('le message « compte non autorisé » explique quoi faire', async () => {
  await render(
    <SignInScreen
      signingIn={false}
      offline={false}
      message={signInFailureText('forbidden')}
      onSignIn={() => {}}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    /limitée à cinq comptes\. Demande à la personne qui la gère de t’ajouter, puis reconnecte-toi\./,
  );
});

it('chaque motif a son message, sauf l’annulation volontaire', () => {
  expect(signInFailureText('cancelled')).toBeNull();
  for (const failure of ['denied', 'network', 'forbidden', 'failed'] as const) {
    expect(signInFailureText(failure)).toEqual(expect.any(String));
  }
  expect(signedOutText('expired')).toMatch(/expiré/);
  expect(signedOutText('forbidden')).toBe(signInFailureText('forbidden'));
  expect(signedOutText('signedOut')).toBeNull();
  expect(signedOutText(null)).toBeNull();
});

it('hors ligne, la connexion attend le réseau', async () => {
  const onSignIn = jest.fn();
  await render(<SignInScreen signingIn={false} offline message={null} onSignIn={onSignIn} />);

  expect(screen.getByText(/la connexion à Spotify reprendra avec le réseau/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Se connecter avec Spotify' }));
  expect(onSignIn).not.toHaveBeenCalled();
});
