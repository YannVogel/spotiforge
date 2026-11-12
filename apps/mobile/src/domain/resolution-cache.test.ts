import { resolutionKey } from './resolution-cache';

it('donne la même clé aux écritures équivalentes d’un même titre', () => {
  expect(resolutionKey('The Rolling Stones', "(I Can't Get No) Satisfaction - Mono Version")).toBe(
    resolutionKey('Rolling Stones', '(I Can’t Get No) Satisfaction'),
  );
  expect(resolutionKey('Röyksopp', 'What Else Is There?')).toBe('royksopp|what else is there');
});

it('distingue deux artistes pour un même titre', () => {
  expect(resolutionKey('Kavinsky', 'Nightcall')).not.toBe(
    resolutionKey('London Grammar', 'Nightcall'),
  );
});
