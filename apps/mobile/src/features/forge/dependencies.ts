import { ForgeError } from '../../domain/forge';
import { getAppServices } from '../app/services';
import { useSessionStore } from '../session/session-store';
import type { ForgeControllerDependencies } from './forge-controller';

/** Dépendances réelles de la forge et de la reforge, pour le compte connecté. */
export async function forgeDependencies(): Promise<ForgeControllerDependencies> {
  const services = await getAppServices();
  const { session } = useSessionStore.getState();
  if (session.status !== 'signedIn') throw new ForgeError('unauthorized');
  return { ...services, ownerSpotifyId: session.account.id };
}
