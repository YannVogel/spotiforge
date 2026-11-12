import { isOffline } from './online';

it.each([
  [{ isConnected: true, isInternetReachable: true }, false],
  [{ isConnected: false, isInternetReachable: false }, true],
  [{ isConnected: true, isInternetReachable: false }, true],
  [{ isConnected: false }, true],
  [{}, false],
])('%o → hors ligne : %s', (state, offline) => {
  expect(isOffline(state)).toBe(offline);
});
