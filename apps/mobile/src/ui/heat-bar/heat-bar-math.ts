export type Range = { min: number; max: number; step: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondit au pas le plus proche (compté depuis `min`), dans les bornes. */
export function snapToStep(value: number, { min, max, step }: Range): number {
  const steps = Math.round((value - min) / step);
  // Évite les résidus flottants (0.1 + 0.2…) sans figer un nombre de décimales.
  const snapped = Number((min + steps * step).toPrecision(12));
  return clamp(snapped, min, max);
}

/** Valeur correspondant à une position horizontale `x` sur une barre de largeur `width`. */
export function valueFromPosition(x: number, width: number, range: Range): number {
  if (width <= 0) return range.min;
  const ratio = clamp(x / width, 0, 1);
  return snapToStep(range.min + ratio * (range.max - range.min), range);
}

/** Part de la barre à remplir, de 0 à 1. */
export function fillRatio(value: number, { min, max }: Pick<Range, 'min' | 'max'>): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Valeur après un pas vers le haut (`+1`) ou vers le bas (`-1`), dans les bornes. */
export function stepValue(value: number, direction: 1 | -1, range: Range): number {
  return snapToStep(snapToStep(value, range) + direction * range.step, range);
}
