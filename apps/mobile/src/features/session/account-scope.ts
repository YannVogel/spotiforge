import { useAnvilStore } from '../anvil/anvil-store';
import { useDraftStore } from '../draft/draft-store';
import { useForgeStore } from '../forge/forge-store';
import { useResumeStore } from '../pieces/resume-store';
import { useAlloyStore } from '../taste/taste-store';
import type { SessionManager } from './session-manager';
import { useSessionStore } from './session-store';

/**
 * Oublie tout ce que la mémoire de l'app garde pour un compte : brouillon, pièce sur l'enclume,
 * forge en cours, proposition de reprise, disponibilité de l'alliage. L'historique enregistré
 * (pièces, moules) reste sur le téléphone, masqué : il n'est lu que pour son propre compte.
 */
export function forgetAccountState(): void {
  useForgeStore.getState().abort?.abort();
  useDraftStore.setState(useDraftStore.getInitialState(), true);
  useAnvilStore.setState(useAnvilStore.getInitialState(), true);
  useForgeStore.setState(useForgeStore.getInitialState(), true);
  useResumeStore.setState(useResumeStore.getInitialState(), true);
  useAlloyStore.setState(useAlloyStore.getInitialState(), true);
}

type SignOutDependencies = {
  session: Pick<SessionManager, 'signOut'>;
  tasteCache: { clear(ownerSpotifyId: string): Promise<void> };
};

/**
 * Déconnexion voulue : jetons supprimés, résumé des écoutes du compte effacé, mémoire de l'app
 * vidée. Les pièces et les moules restent sur le téléphone, et réapparaissent si le même compte
 * se reconnecte (docs/ARCHITECTURE.md).
 */
export async function signOutAndForget({ session, tasteCache }: SignOutDependencies) {
  const current = useSessionStore.getState().session;
  const ownerSpotifyId = current.status === 'signedIn' ? current.account.id : null;
  await session.signOut();
  forgetAccountState();
  if (ownerSpotifyId) await tasteCache.clear(ownerSpotifyId);
}

/**
 * Quand un autre compte se connecte sur le téléphone (après une session expirée, par exemple),
 * rien de ce que le compte précédent avait en mémoire ne doit lui apparaître. Une session
 * simplement expirée, elle, garde le brouillon. Renvoie de quoi arrêter la surveillance.
 */
export function watchAccountChanges(): () => void {
  let lastAccountId: string | null = null;
  const remember = () => {
    const { session } = useSessionStore.getState();
    if (session.status !== 'signedIn') return;
    if (lastAccountId !== null && lastAccountId !== session.account.id) forgetAccountState();
    lastAccountId = session.account.id;
  };
  remember();
  return useSessionStore.subscribe(remember);
}
