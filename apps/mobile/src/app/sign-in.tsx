import { signedOutText, signInFailureText } from '../features/auth/copy';
import { signInDependencies } from '../features/auth/dependencies';
import { startSignIn } from '../features/auth/sign-in';
import { useSignInStore } from '../features/auth/sign-in-store';
import { SignInScreen } from '../features/auth/SignInScreen';
import { useOffline } from '../features/network/online';
import { useSessionStore } from '../features/session/session-store';

/** Connexion : le seul écran accessible sans session. */
export default function SignInRoute() {
  const state = useSignInStore((store) => store.state);
  const session = useSessionStore((store) => store.session);
  const offline = useOffline();
  const message =
    state.status === 'failed'
      ? signInFailureText(state.failure)
      : session.status === 'signedOut'
        ? signedOutText(session.reason)
        : null;

  return (
    <SignInScreen
      signingIn={state.status === 'signingIn'}
      offline={offline}
      message={message}
      onSignIn={() => void startSignIn(signInDependencies)}
    />
  );
}
