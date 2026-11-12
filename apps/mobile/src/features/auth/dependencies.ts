import { signInWithSpotify } from '../../infra/spotify/auth';
import { getAppServices } from '../app/services';
import { signOutAndForget } from '../session/account-scope';

/** Dépendances réelles de la connexion : page Spotify (PKCE) et session. */
export async function signInDependencies() {
  const { session, config } = await getAppServices();
  return {
    session,
    authorize: () =>
      signInWithSpotify({
        clientId: config.spotifyClientId,
        redirectScheme: config.redirectScheme,
      }),
  };
}

/** Déconnexion voulue, avec ce qu'elle doit oublier (docs/ARCHITECTURE.md). */
export async function signOut(): Promise<void> {
  const { session, tasteCache } = await getAppServices();
  await signOutAndForget({ session, tasteCache });
}
