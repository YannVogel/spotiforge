import { createSerialSaver } from './serial-saver';

function deferredSave() {
  const saved: number[] = [];
  const releases: (() => void)[] = [];
  const save = jest.fn(
    (value: number) =>
      new Promise<void>((resolve) => {
        releases.push(() => {
          saved.push(value);
          resolve();
        });
      }),
  );
  const releaseNext = async () => {
    await Promise.resolve();
    releases.shift()?.();
    await Promise.resolve();
  };
  return { save, saved, releaseNext };
}

it('écrit une valeur à la fois et ne garde que la plus récente des valeurs en attente', async () => {
  const { save, saved, releaseNext } = deferredSave();
  const saver = createSerialSaver(save, jest.fn());

  saver.save(1);
  saver.save(2);
  saver.save(3);
  await releaseNext();
  await releaseNext();
  await saver.idle();

  expect(save).toHaveBeenCalledTimes(2);
  expect(saved).toEqual([1, 3]);
});

it('signale une écriture ratée et continue avec la suivante', async () => {
  const onError = jest.fn();
  const save = jest
    .fn<Promise<void>, [string]>()
    .mockRejectedValueOnce(new Error('disk full'))
    .mockResolvedValueOnce();
  const saver = createSerialSaver(save, onError);

  saver.save('a');
  await saver.idle();
  saver.save('b');
  await saver.idle();

  expect(onError).toHaveBeenCalledWith(new Error('disk full'));
  expect(save).toHaveBeenLastCalledWith('b');
});
