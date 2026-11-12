import type { PieceRecord, PieceRepository } from '../../domain/history';
import { useAnvilStore } from '../anvil/anvil-store';
import { createSerialSaver } from './serial-saver';

/**
 * Enregistre sur le téléphone la pièce de l'enclume à chacun de ses changements : première forge,
 * trempe, reforge (refusés compris), édition, envoi (dès la création de la playlist). Renvoie de
 * quoi arrêter l'enregistrement.
 */
export function startPiecePersistence(repository: Pick<PieceRepository, 'save'>) {
  const saver = createSerialSaver<PieceRecord>(
    (record) => repository.save(record),
    // Seul le type d'erreur est journalisé : jamais le contenu de la pièce.
    (error) =>
      console.error(
        'Could not save the piece locally',
        error instanceof Error ? error.name : 'unknown',
      ),
  );
  const unsubscribe = useAnvilStore.subscribe((state, previous) => {
    if (state.record && state.record !== previous.record) saver.save(state.record);
  });
  return { stop: unsubscribe, idle: saver.idle };
}
