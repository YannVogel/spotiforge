import type { SignInResult } from '../../infra/spotify/auth';
import { SignInRejectedError } from '../session/session-manager';
import { startSignIn } from './sign-in';
import { useSignInStore } from './sign-in-store';

const tokens = { accessToken: 'fake-access', refreshToken: 'fake-refresh', expiresAt: 0 };

function dependencies(
  result: SignInResult,
  signIn = jest.fn(async () => ({ id: 'fake-account', displayName: null })),
) {
  const authorize = jest.fn(async () => result);
  return { deps: async () => ({ authorize, session: { signIn } }), authorize, signIn };
}

beforeEach(() => {
  useSignInStore.setState(useSignInStore.getInitialState(), true);
});

it('ouvre la session avec les jetons obtenus', async () => {
  const { deps, signIn } = dependencies({ ok: true, tokens });

  await startSignIn(deps);

  expect(signIn).toHaveBeenCalledWith(tokens);
  expect(useSignInStore.getState().state).toEqual({ status: 'idle' });
});

it.each(['cancelled', 'denied', 'network', 'failed'] as const)(
  'refus ou échec côté Spotify (%s) : rien n’est ouvert, le motif est gardé',
  async (reason) => {
    const { deps, signIn } = dependencies({ ok: false, reason });

    await startSignIn(deps);

    expect(signIn).not.toHaveBeenCalled();
    expect(useSignInStore.getState().state).toEqual({ status: 'failed', failure: reason });
  },
);

it('compte hors des cinq autorisés : motif « forbidden »', async () => {
  const { deps } = dependencies(
    { ok: true, tokens },
    jest.fn(async () => {
      throw new SignInRejectedError('forbidden');
    }),
  );

  await startSignIn(deps);

  expect(useSignInStore.getState().state).toEqual({ status: 'failed', failure: 'forbidden' });
});

it('Spotify injoignable à la lecture du compte : motif « network »', async () => {
  const { deps } = dependencies(
    { ok: true, tokens },
    jest.fn(async () => {
      throw new SignInRejectedError('unavailable');
    }),
  );

  await startSignIn(deps);

  expect(useSignInStore.getState().state).toEqual({ status: 'failed', failure: 'network' });
});

it('ignore un second appui pendant la connexion', async () => {
  const { deps, authorize } = dependencies({ ok: true, tokens });

  await Promise.all([startSignIn(deps), startSignIn(deps)]);

  expect(authorize).toHaveBeenCalledTimes(1);
});
