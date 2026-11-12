import { type ColorName, colors } from './index';

// Garde-fou d'accessibilité (docs/DESIGN.md) : tout texte garde un contraste d'au moins 4,5:1
// avec son fond, 3:1 à partir de 24 px. Une paire par association réellement utilisée à l'écran.

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const channels = (hex.slice(1).match(/../g) ?? []).map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: ColorName, background: ColorName): number {
  const [light, dark] = [luminance(colors[foreground]), luminance(colors[background])].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const NORMAL = 4.5;
const LARGE = 3;

const PAIRS: [ColorName, ColorName, number, string][] = [
  ['text', 'bg', NORMAL, 'texte courant'],
  ['textSoft', 'bg', NORMAL, 'description, messages'],
  ['textMuted', 'bg', NORMAL, 'lien de déconnexion'],
  ['textSoft', 'surface', NORMAL, 'légende, proposition de reprise'],
  ['text', 'surfaceHot', NORMAL, 'titre d’un morceau à chaud'],
  ['textMuted', 'surfaceHot', NORMAL, 'métadonnées à chaud'],
  ['textSoft', 'surfaceHot', NORMAL, 'raison à chaud'],
  ['text', 'surfaceCold', NORMAL, 'titre d’un morceau trempé'],
  ['textMuted', 'surfaceCold', NORMAL, 'métadonnées trempé'],
  ['textSoft', 'surfaceCold', NORMAL, 'raison trempé'],
  ['flame', 'surfaceHot', NORMAL, 'bouton « Tremper » (18 px)'],
  ['flame', 'bg', NORMAL, 'bouton secondaire, libellé « À chaud »'],
  ['steel', 'surfaceCold', LARGE, 'numéro trempé (42 px)'],
  ['steel', 'surface', LARGE, 'compteur « 3 TREMPÉS » (26 px)'],
  ['steel', 'bg', NORMAL, 'confirmation d’envoi'],
  ['emberSoft', 'surface', NORMAL, 'libellé du minerai (12 px)'],
  ['emberSoft', 'bg', NORMAL, '« SUR L’ENCLUME »'],
  ['onEmber', 'ember', NORMAL, 'bouton principal'],
  ['onEmber', 'emberSoft', NORMAL, 'bouton principal appuyé'],
  ['onEmber', 'steel', NORMAL, 'bouton « Trempé »'],
];

it.each(PAIRS)('%s sur %s : contraste suffisant (%s:1, %s)', (foreground, background, min) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(min);
});

it('calcule le contraste WCAG attendu sur des valeurs connues', () => {
  expect(luminance('#FFFFFF')).toBeCloseTo(1);
  expect(luminance('#000000')).toBeCloseTo(0);
});
