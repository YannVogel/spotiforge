import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { impactAsync } from 'expo-haptics';
import { AccessibilityInfo, Animated } from 'react-native';

import { TrackRow } from './TrackRow';
import { FLARE_MS, QUENCH_MS } from './use-track-motion';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(async () => {}),
}));

const props = { number: 1, title: 'Nightcall', meta: 'Kavinsky · 2010', reason: 'Raison' };

let timing: jest.SpyInstance;

beforeEach(() => {
  timing = jest.spyOn(Animated, 'timing');
  jest.mocked(impactAsync).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderRow(reducedMotion: boolean, quenched = false, pending = false) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reducedMotion);
  const onToggleQuench = jest.fn();
  const view = await render(
    <TrackRow {...props} quenched={quenched} pending={pending} onToggleQuench={onToggleQuench} />,
  );
  await act(async () => {});
  timing.mockClear();
  return {
    onToggleQuench,
    rerender: (next: { quenched?: boolean; pending?: boolean }) =>
      view.rerender(
        <TrackRow
          {...props}
          quenched={next.quenched ?? quenched}
          pending={next.pending ?? pending}
          onToggleQuench={onToggleQuench}
        />,
      ),
  };
}

const durations = () => timing.mock.calls.map(([, config]) => config.duration);

it('la trempe refroidit le titre en 300 ms', async () => {
  const { rerender } = await renderRow(false);

  await rerender({ quenched: true });

  expect(durations()).toEqual([QUENCH_MS]);
});

it('le départ d’une reforge embrase brièvement le titre', async () => {
  const { rerender } = await renderRow(false);

  await rerender({ pending: true });

  expect(durations()).toEqual([FLARE_MS / 2, FLARE_MS / 2]);
});

it('avec la réduction des animations, rien n’est animé', async () => {
  const { rerender } = await renderRow(true);

  await rerender({ quenched: true });
  await rerender({ quenched: true, pending: true });

  expect(timing).not.toHaveBeenCalled();
});

it('l’état se lit tout de suite, sans attendre la fin de l’animation', async () => {
  jest.useFakeTimers();
  const { rerender } = await renderRow(false);

  await rerender({ quenched: true });

  expect(screen.getByRole('button', { name: 'Remettre au feu Nightcall' })).toBeSelected();
  expect(screen.getByText('TREMPÉ')).toBeOnTheScreen();
  jest.useRealTimers();
});

it('un retour haptique léger accompagne la trempe, pas la remise au feu', async () => {
  await renderRow(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Nightcall' }));
  expect(impactAsync).toHaveBeenCalledWith('light');

  jest.mocked(impactAsync).mockClear();
  await render(<TrackRow {...props} quenched onToggleQuench={() => {}} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Remettre au feu Nightcall' }));
  expect(impactAsync).not.toHaveBeenCalled();
});

it('un moteur haptique absent ne bloque pas la trempe', async () => {
  jest.mocked(impactAsync).mockRejectedValueOnce(new Error('unavailable'));
  const { onToggleQuench } = await renderRow(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Nightcall' }));

  expect(onToggleQuench).toHaveBeenCalledTimes(1);
});

it('un module haptique qui lève tout de suite ne bloque pas non plus la trempe', async () => {
  jest.mocked(impactAsync).mockImplementationOnce(() => {
    throw new Error('Cannot find native module');
  });
  const { onToggleQuench } = await renderRow(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Tremper Nightcall' }));

  expect(onToggleQuench).toHaveBeenCalledTimes(1);
});
