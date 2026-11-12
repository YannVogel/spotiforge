// Seul point d'entrée de design/tokens.json dans l'app : tout le thème en découle.
import tokens from '../../../../../design/tokens.json';

export { tokens };

export type ColorName = keyof typeof tokens.color;
export type GradientName = keyof typeof tokens.gradient;
export type GlowName = keyof typeof tokens.glow;
export type FontRole = keyof typeof tokens.font;
export type TextVariant = keyof typeof tokens.type;
export type SpaceName = keyof typeof tokens.space;

/** Style de texte tel qu'écrit dans les tokens (tailles en px, interlignage et espacement relatifs). */
export type TypeToken = {
  font: string;
  weight: number;
  size: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
};
