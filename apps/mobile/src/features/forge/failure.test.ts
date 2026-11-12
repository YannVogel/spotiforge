import { ForgeError } from '../../domain/forge';
import { NotSignedInError } from '../../domain/session';
import { SpotifyError } from '../../domain/spotify';
import { forgeFailureOf } from './failure';
import { NoTracksFoundError } from './forge-run';

it.each([
  [new ForgeError('unauthorized'), { kind: 'signed_out' }],
  [new ForgeError('forbidden'), { kind: 'forbidden' }],
  [new ForgeError('rate_limited'), { kind: 'rate_limited' }],
  [new ForgeError('rate_limited', 90), { kind: 'rate_limited', retryAfterMinutes: 2 }],
  [new ForgeError('rate_limited', 5), { kind: 'rate_limited', retryAfterMinutes: 1 }],
  [new ForgeError('unavailable'), { kind: 'unavailable' }],
  [new ForgeError('network'), { kind: 'offline' }],
  [new ForgeError('invalid_request'), { kind: 'bug' }],
  [new SpotifyError('unauthorized'), { kind: 'signed_out' }],
  [new SpotifyError('forbidden', 403), { kind: 'forbidden' }],
  [new SpotifyError('rate_limited', 429), { kind: 'spotify_busy' }],
  [new SpotifyError('network'), { kind: 'offline' }],
  [new SpotifyError('unavailable', 503), { kind: 'unavailable' }],
  [new NotSignedInError('no session'), { kind: 'signed_out' }],
  [new NoTracksFoundError('none'), { kind: 'no_tracks' }],
  [new TypeError('bug'), { kind: 'bug' }],
])('%s → %o', (error, failure) => {
  expect(forgeFailureOf(error)).toEqual(failure);
});
