import type { SignInResult } from '../../infra/spotify/auth';
import { type SessionManager, SignInRejectedError } from '../session/session-manager';
import { type SignInFailure, useSignInStore } from './sign-in-store';

type Dependencies = {
  /** Ouvre la page de connexion Spotify (PKCE) et renvoie les jetons. */
  authorize: () => Promise<SignInResult>;
  session: Pick<SessionManager, 'signIn'>;
};

function failureOf(error: unknown): SignInFailure {
  if (error instanceof SignInRejectedError) {
    return error.reason === 'forbidden' ? 'forbidden' : 'network';
  }
  return 'failed';
}

/**
 * Connexion avec Spotify : page d'autorisation, puis lecture du compte et enregistrement de la
 * session. La garde de navigation bascule d'elle-même sur l'écran Création quand la session est
 * ouverte. Un second appui pendant la connexion est ignoré.
 */
export async function startSignIn(getDependencies: () => Promise<Dependencies>): Promise<void> {
  if (useSignInStore.getState().state.status === 'signingIn') return;
  useSignInStore.setState({ state: { status: 'signingIn' } });
  const fail = (failure: SignInFailure) =>
    useSignInStore.setState({ state: { status: 'failed', failure } });

  try {
    const { authorize, session } = await getDependencies();
    const result = await authorize();
    if (!result.ok) {
      fail(result.reason);
      return;
    }
    await session.signIn(result.tokens);
    useSignInStore.setState({ state: { status: 'idle' } });
  } catch (error) {
    fail(failureOf(error));
  }
}
