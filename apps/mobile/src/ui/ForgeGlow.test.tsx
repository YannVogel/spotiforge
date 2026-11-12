import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { ForgeGlow } from './ForgeGlow';

let loopStart: jest.Mock;
let loopStop: jest.Mock;

beforeEach(() => {
  loopStart = jest.fn();
  loopStop = jest.fn();
  jest
    .spyOn(Animated, 'loop')
    .mockReturnValue({ start: loopStart, stop: loopStop, reset: jest.fn() });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderGlow(pulsing: boolean, reducedMotion: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reducedMotion);
  await render(<ForgeGlow pulsing={pulsing} />);
  // Laisse la lecture du réglage système aboutir.
  await act(async () => {});
}

it('pulse pendant la forge', async () => {
  await renderGlow(true, false);

  expect(loopStart).toHaveBeenCalled();
});

it('reste fixe hors forge', async () => {
  await renderGlow(false, false);

  expect(loopStart).not.toHaveBeenCalled();
});

it('ne laisse aucune pulsation active quand le système demande de réduire les animations', async () => {
  await renderGlow(true, true);

  // Le réglage arrive après le premier rendu : une pulsation lancée entre-temps est arrêtée.
  expect(loopStop).toHaveBeenCalledTimes(loopStart.mock.calls.length);
});

it('est masquée aux lecteurs d’écran', async () => {
  await renderGlow(true, false);

  expect(screen.queryByTestId('forge-glow')).toBeNull();
});
