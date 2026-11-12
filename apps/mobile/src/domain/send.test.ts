import { isSentAndUnchanged, PLAYLIST_BATCH_SIZE, sendPiece } from './send';
import { SpotifyError } from './spotify';
import { makePieceRecord, makePieceTrack } from './test-fixtures';

const NOW = new Date('2026-11-12T12:00:00.000Z');

function fakeSpotify() {
  const playlists = new Map<string, string[]>();
  let created = 0;
  const spotify = {
    createPlaylist: jest.fn(async (_details: { name: string; description: string }) => {
      const id = `fakePlaylist${++created}`;
      playlists.set(id, []);
      return { id };
    }),
    replacePlaylistItems: jest.fn(async (id: string, uris: readonly string[]) => {
      playlists.set(id, [...uris]);
    }),
    addPlaylistItems: jest.fn(async (id: string, uris: readonly string[]) => {
      playlists.set(id, [...(playlists.get(id) ?? []), ...uris]);
    }),
  };
  return { spotify, playlists };
}

const record = (trackCount: number) =>
  makePieceRecord({
    title: 'Route de nuit',
    description: 'Des synthés qui montent.',
    tracks: Array.from({ length: trackCount }, (_, i) => makePieceTrack(i)),
  });

it('crée une playlist avec le nom et la description, et y met les titres dans l’ordre', async () => {
  const { spotify, playlists } = fakeSpotify();
  const piece = record(3);

  const sent = await sendPiece(piece, { spotify, now: () => NOW });

  expect(spotify.createPlaylist).toHaveBeenCalledWith({
    name: 'Route de nuit',
    description: 'Des synthés qui montent.',
  });
  expect(playlists.get('fakePlaylist1')).toEqual(piece.tracks.map((t) => t.spotifyUri));
  expect(sent).toMatchObject({
    spotifyPlaylistId: 'fakePlaylist1',
    sentAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  expect(isSentAndUnchanged(sent)).toBe(true);
});

it('découpe les titres en lots de 100 : un remplacement puis des ajouts', async () => {
  const { spotify, playlists } = fakeSpotify();
  const piece = record(230);

  await sendPiece(piece, { spotify, now: () => NOW });

  expect(spotify.replacePlaylistItems).toHaveBeenCalledTimes(1);
  expect(spotify.addPlaylistItems.mock.calls.map(([, uris]) => uris.length)).toEqual([100, 30]);
  expect(spotify.replacePlaylistItems.mock.calls[0]?.[1]).toHaveLength(PLAYLIST_BATCH_SIZE);
  expect(playlists.get('fakePlaylist1')).toEqual(piece.tracks.map((t) => t.spotifyUri));
});

it('échec au deuxième lot puis reprise : une seule playlist, sans doublon', async () => {
  const { spotify, playlists } = fakeSpotify();
  spotify.addPlaylistItems.mockRejectedValueOnce(new SpotifyError('network'));
  const piece = record(150);
  let createdId: string | null = null;

  await expect(
    sendPiece(piece, {
      spotify,
      now: () => NOW,
      onPlaylistCreated: (id) => {
        createdId = id;
      },
    }),
  ).rejects.toThrow(new SpotifyError('network'));
  expect(createdId).toBe('fakePlaylist1');
  expect(playlists.get('fakePlaylist1')).toHaveLength(100);

  await sendPiece({ ...piece, spotifyPlaylistId: createdId }, { spotify, now: () => NOW });

  expect(spotify.createPlaylist).toHaveBeenCalledTimes(1);
  expect(playlists.size).toBe(1);
  expect(playlists.get('fakePlaylist1')).toEqual(piece.tracks.map((t) => t.spotifyUri));
});

it('renvoyer une pièce déjà envoyée réutilise sa playlist', async () => {
  const { spotify, playlists } = fakeSpotify();
  playlists.set('existing', ['spotify:track:old']);

  await sendPiece({ ...record(2), spotifyPlaylistId: 'existing' }, { spotify, now: () => NOW });

  expect(spotify.createPlaylist).not.toHaveBeenCalled();
  expect(playlists.get('existing')).toEqual(['spotify:track:fake0', 'spotify:track:fake1']);
});

it('laisse remonter un 403 sans rien marquer comme envoyé', async () => {
  const { spotify } = fakeSpotify();
  spotify.createPlaylist.mockRejectedValueOnce(new SpotifyError('forbidden', 403));

  await expect(sendPiece(record(2), { spotify, now: () => NOW })).rejects.toThrow(
    new SpotifyError('forbidden', 403),
  );
  expect(spotify.replacePlaylistItems).not.toHaveBeenCalled();
});

it('isSentAndUnchanged : non envoyée, ou modifiée depuis l’envoi', () => {
  expect(isSentAndUnchanged(record(1))).toBe(false);
  expect(
    isSentAndUnchanged({
      ...record(1),
      sentAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T11:00:00.000Z',
    }),
  ).toBe(false);
});
