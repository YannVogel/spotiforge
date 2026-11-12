import { openTrack } from './open-track';

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
