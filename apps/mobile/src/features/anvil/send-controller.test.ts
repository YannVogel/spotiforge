import { SpotifyError } from '../../domain/spotify';
import { makePieceRecord } from '../../infra/db/fixtures';
import { useAnvilStore } from './anvil-store';
import { sendFailureOf } from './send-failure';
import { recreatePlaylist, type SendDependencies, startSend } from './send-controller';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const record = makePieceRecord();

function spotify() {
  return {
    createPlaylist: jest.fn(async () => ({ id: 'fakePlaylist1' })),
    replacePlaylistItems: jest.fn(async () => {}),
    addPlaylistItems: jest.fn(async () => {}),
    updatePlaylistDetails: jest.fn(async () => {}),
  };
}

const deps = (fake: ReturnType<typeof spotify>) => async (): Promise<SendDependencies> => ({
  spotify: fake,
  now: () => NOW,
});

beforeEach(() => {
  useAnvilStore.setState(useAnvilStore.getInitialState(), true);
  useAnvilStore.getState().open(record);
});

it('envoie la pièce et note la playlist et la date d’envoi', async () => {
  const fake = spotify();

  const running = startSend(deps(fake));
  expect(useAnvilStore.getState().send).toEqual({ status: 'sending' });
  await running;

  expect(useAnvilStore.getState().send).toEqual({ status: 'idle' });
  expect(useAnvilStore.getState().record).toMatchObject({
    spotifyPlaylistId: 'fakePlaylist1',
    sentAt: NOW.toISOString(),
  });
});

it('un double appui n’envoie qu’une fois', async () => {
  const fake = spotify();

  await Promise.all([startSend(deps(fake)), startSend(deps(fake))]);

  expect(fake.createPlaylist).toHaveBeenCalledTimes(1);
  expect(fake.replacePlaylistItems).toHaveBeenCalledTimes(1);
});

it('après un échec en cours de route, la reprise réutilise la playlist créée', async () => {
  const fake = spotify();
  fake.replacePlaylistItems.mockRejectedValueOnce(new SpotifyError('network'));

  await startSend(deps(fake));
  expect(useAnvilStore.getState().send).toEqual({ status: 'failed', failure: 'offline' });
  expect(useAnvilStore.getState().record?.spotifyPlaylistId).toBe('fakePlaylist1');
  expect(useAnvilStore.getState().record?.sentAt).toBeNull();

  await startSend(deps(fake));

  expect(fake.createPlaylist).toHaveBeenCalledTimes(1);
  expect(useAnvilStore.getState().record?.sentAt).toBe(NOW.toISOString());
});

it('n’envoie pas pendant une reforge', async () => {
  const fake = spotify();
  useAnvilStore.setState({ reforge: { status: 'reforging' } });

  await startSend(deps(fake));

  expect(fake.createPlaylist).not.toHaveBeenCalled();
});

it.each([
  [new SpotifyError('forbidden', 403), 'forbidden'],
  [new SpotifyError('network'), 'offline'],
  [new SpotifyError('rate_limited', 429), 'spotify_busy'],
  [new SpotifyError('unavailable', 500), 'unavailable'],
  [new SpotifyError('unauthorized', 401), 'signed_out'],
  [new TypeError('bug'), 'bug'],
] as const)('traduit %s en « %s »', (error, failure) => {
  expect(sendFailureOf(error)).toBe(failure);
});

it('une playlist disparue est signalée, puis recréée à la demande', async () => {
  const fake = spotify();
  fake.replacePlaylistItems.mockRejectedValueOnce(new SpotifyError('unavailable', 404));
  useAnvilStore.getState().open({
    ...record,
    spotifyPlaylistId: 'gone',
    sentAt: '2026-11-11T20:00:00.000Z',
  });

  await startSend(deps(fake));
  expect(useAnvilStore.getState().send).toEqual({ status: 'failed', failure: 'playlist_missing' });

  await recreatePlaylist(deps(fake));

  expect(fake.createPlaylist).toHaveBeenCalledTimes(1);
  expect(useAnvilStore.getState().record).toMatchObject({
    spotifyPlaylistId: 'fakePlaylist1',
    sentAt: NOW.toISOString(),
  });
});
