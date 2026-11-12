import { create } from 'zustand';

/** Pourquoi la dernière tentative de connexion n'a pas abouti. */
export type SignInFailure = 'cancelled' | 'denied' | 'network' | 'forbidden' | 'failed';

export type SignInState =
  { status: 'idle' } | { status: 'signingIn' } | { status: 'failed'; failure: SignInFailure };

export const useSignInStore = create<{ state: SignInState }>()(() => ({
  state: { status: 'idle' },
}));
