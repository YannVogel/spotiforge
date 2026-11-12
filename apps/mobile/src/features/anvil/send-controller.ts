import { forgetPlaylist, sendPiece } from '../../domain/send';
import type { SpotifyGateway } from '../../domain/spotify';
import { useAnvilStore } from './anvil-store';
import { sendFailureOf } from './send-failure';

export type SendDependencies = {
  spotify: Pick<
    SpotifyGateway,
    'createPlaylist' | 'replacePlaylistItems' | 'addPlaylistItems' | 'updatePlaylistDetails'
  >;
  now: () => Date;
};

/**
 * Envoie la pièce sur l'enclume vers Spotify. Un second appui pendant l'envoi est ignoré. La
 * playlist créée est notée sur la pièce dès sa création : un nouvel essai après une panne la
 * réutilise, sans en créer une seconde.
 */
export async function startSend(getDependencies: () => Promise<SendDependencies>): Promise<void> {
  const { record, send, reforge } = useAnvilStore.getState();
  if (!record || send.status === 'sending' || reforge.status === 'reforging') return;
  useAnvilStore.setState({ send: { status: 'sending' } });
  const isSamePiece = () => useAnvilStore.getState().record?.id === record.id;

  try {
    const sent = await sendPiece(record, {
      ...(await getDependencies()),
      onPlaylistCreated: (spotifyPlaylistId) => {
        const current = useAnvilStore.getState().record;
        if (current?.id === record.id) {
          useAnvilStore.setState({ record: { ...current, spotifyPlaylistId } });
        }
      },
    });
    const current = useAnvilStore.getState().record;
    if (!current || !isSamePiece()) return;
    // La trempe a pu changer pendant l'envoi : seuls les champs de l'envoi sont repris.
    const { spotifyPlaylistId, sentAt, updatedAt } = sent;
    useAnvilStore.setState({
      record: { ...current, spotifyPlaylistId, sentAt, updatedAt },
      send: { status: 'idle' },
    });
  } catch (error) {
    if (!isSamePiece()) return;
    useAnvilStore.setState({ send: { status: 'failed', failure: sendFailureOf(error) } });
  }
}

/** La playlist a disparu de Spotify et la personne veut la recréer : une nouvelle est créée. */
export async function recreatePlaylist(
  getDependencies: () => Promise<SendDependencies>,
): Promise<void> {
  const { record, send } = useAnvilStore.getState();
  if (!record || send.status === 'sending') return;
  useAnvilStore.setState({ record: forgetPlaylist(record), send: { status: 'idle' } });
  await startSend(getDependencies);
}
