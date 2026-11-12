import type { PieceRecord, PieceRepository } from '../../domain/history';
import { latestUnsent } from '../../domain/resume';
import { useAnvilStore } from '../anvil/anvil-store';
import { useResumeStore } from './resume-store';

type Repository = Pick<PieceRepository, 'list' | 'findById'>;

/** Au lancement : cherche une fois la dernière pièce non envoyée du compte. */
export async function checkSavedPiece(repository: Repository, ownerSpotifyId: string) {
  if (useResumeStore.getState().checked) return;
  useResumeStore.setState({ checked: true });
  const saved = latestUnsent(await repository.list(ownerSpotifyId));
  useResumeStore.setState({ saved });
}

/** Ce que l'écran Création propose de reprendre : la pièce sur l'enclume, sinon celle du lancement. */
export function resumeOffer(): { id: string; title: string } | null {
  if (useResumeStore.getState().dismissed) return null;
  const current = useAnvilStore.getState().record;
  if (current) return { id: current.id, title: current.title };
  const { saved } = useResumeStore.getState();
  return saved ? { id: saved.id, title: saved.title } : null;
}

/**
 * Remet la pièce proposée sur l'enclume (relue sur le téléphone si besoin, trempe et refusés
 * compris). Renvoie `null` si elle a disparu entre-temps.
 */
export async function resumePiece(
  repository: Repository,
  ownerSpotifyId: string,
  id: string,
): Promise<PieceRecord | null> {
  const current = useAnvilStore.getState().record;
  if (current?.id === id) return current;
  const record = await repository.findById(ownerSpotifyId, id);
  if (!record) {
    useResumeStore.setState({ saved: null });
    return null;
  }
  useAnvilStore.getState().open(record);
  return record;
}

export function dismissResume(): void {
  useResumeStore.setState({ dismissed: true });
}
