import { openPlaylist, openTrack } from './open-in-spotify';

const uri = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';

it('ouvre le titre dans l’app Spotify', async () => {
  const openURL = jest.fn(async () => true);

  expect(await openTrack(uri, openURL)).toBe(true);
  expect(openURL).toHaveBeenCalledWith(uri);
  expect(openURL).toHaveBeenCalledTimes(1);
});

it('se rabat sur la page web si l’app n’est pas installée', async () => {
  const openURL = jest
    .fn<Promise<unknown>, [string]>()
    .mockRejectedValueOnce(new Error('No app'))
    .mockResolvedValueOnce(true);

  expect(await openTrack(uri, openURL)).toBe(true);
  expect(openURL).toHaveBeenLastCalledWith('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
});

it('renvoie false si rien ne s’ouvre, sans planter', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const openURL = jest.fn(async () => {
    throw new Error('Nothing');
  });

  expect(await openTrack(uri, openURL)).toBe(false);
  expect(await openTrack('pas une uri', openURL)).toBe(false);
  jest.restoreAllMocks();
});

it('ouvre une playlist dans l’app, ou sa page web', async () => {
  const openURL = jest
    .fn<Promise<unknown>, [string]>()
    .mockRejectedValueOnce(new Error('No app'))
    .mockResolvedValueOnce(true);

  expect(await openPlaylist('3cEYpjA9oz9GiPac4AsH4n', openURL)).toBe(true);
  expect(openURL.mock.calls.map(([url]) => url)).toEqual([
    'spotify:playlist:3cEYpjA9oz9GiPac4AsH4n',
    'https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n',
  ]);
  expect(await openPlaylist('../x', openURL)).toBe(false);
});
