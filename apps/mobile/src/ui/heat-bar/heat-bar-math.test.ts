import { fillRatio, snapToStep, stepValue, valueFromPosition } from './heat-bar-math';

const minutes = { min: 10, max: 120, step: 5 };
const percent = { min: 0, max: 100, step: 10 };

describe('valueFromPosition', () => {
  it.each([
    [0, 10],
    [300, 120],
    [150, 65],
    [-40, 10],
    [999, 120],
  ])('x = %s sur 300 px → %s min', (x, expected) => {
    expect(valueFromPosition(x, 300, minutes)).toBe(expected);
  });

  it('arrondit au pas le plus proche', () => {
    // 0,27 × 110 + 10 = 39,7 → 40
    expect(valueFromPosition(81, 300, minutes)).toBe(40);
    // 0,33 × 100 = 33 → 30 ; 0,36 × 100 = 36 → 40
    expect(valueFromPosition(99, 300, percent)).toBe(30);
    expect(valueFromPosition(108, 300, percent)).toBe(40);
  });

  it('renvoie le minimum tant que la barre n’est pas mesurée', () => {
    expect(valueFromPosition(50, 0, minutes)).toBe(10);
  });
});

describe('snapToStep', () => {
  it('compte les pas depuis le minimum, pas depuis zéro', () => {
    expect(snapToStep(12, { min: 3, max: 30, step: 2 })).toBe(13);
  });

  it('reste dans les bornes même si le maximum n’est pas un multiple du pas', () => {
    expect(snapToStep(29.9, { min: 0, max: 29, step: 5 })).toBe(29);
  });

  it('ne laisse pas de résidu flottant', () => {
    expect(snapToStep(0.3, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
  });
});

describe('fillRatio', () => {
  it.each([
    [10, 0],
    [120, 1],
    [65, 0.5],
    [0, 0],
    [500, 1],
  ])('%s min → %s', (value, expected) => {
    expect(fillRatio(value, minutes)).toBe(expected);
  });

  it('vaut 0 pour un intervalle vide', () => {
    expect(fillRatio(5, { min: 5, max: 5 })).toBe(0);
  });
});

describe('stepValue', () => {
  it('monte et descend d’un pas', () => {
    expect(stepValue(40, 1, minutes)).toBe(45);
    expect(stepValue(40, -1, minutes)).toBe(35);
  });

  it('s’arrête aux bornes', () => {
    expect(stepValue(120, 1, minutes)).toBe(120);
    expect(stepValue(10, -1, minutes)).toBe(10);
  });

  it('recale d’abord une valeur hors pas', () => {
    expect(stepValue(42, 1, minutes)).toBe(45);
  });
});
