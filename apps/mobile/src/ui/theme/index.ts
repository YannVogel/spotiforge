import type { TextStyle, ViewStyle } from 'react-native';

import { fontFamily } from './fonts';
import { toTextShadow } from './shadows';
import {
  type ColorName,
  type GradientName,
  type SpaceName,
  type TextVariant,
  tokens,
  type TypeToken,
} from './tokens';

export { FONT_FILES } from './fonts';
export { useThemeFonts } from './use-theme-fonts';
export type { ColorName, GradientName, SpaceName, TextVariant } from './tokens';

function mapValues<K extends string, V, R>(
  record: Record<K, V>,
  map: (value: V) => R,
): Record<K, R> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, map(value as V)]),
  ) as Record<K, R>;
}

export const colors: Record<ColorName, string> = mapValues(tokens.color, (token) => token.value);

/**
 * Dégradés en syntaxe CSS, utilisables tels quels dans `backgroundImage`
 * (React Native 0.88, nouvelle architecture).
 */
export const gradients: Record<GradientName, string> = tokens.gradient;

/**
 * Lueurs. React Native 0.88 accepte la syntaxe CSS de `box-shadow` dans `boxShadow`, y compris
 * `inset` (Android 10 et plus) : les valeurs des tokens passent sans conversion. La lueur d'un
 * numéro s'applique à un texte, d'où la conversion en `textShadow*`.
 */
export const glows = {
  cta: { boxShadow: tokens.glow.cta },
  heatBar: { boxShadow: tokens.glow.heatBar },
  hotRow: { boxShadow: tokens.glow.hotRow },
  hotNumber: toTextShadow(tokens.glow.hotNumber),
} satisfies Record<keyof typeof tokens.glow, ViewStyle | TextStyle>;

export function toTextStyle(token: TypeToken): TextStyle {
  return {
    fontFamily: fontFamily(token.font, token.weight),
    fontSize: token.size,
    ...(token.lineHeight !== undefined && {
      lineHeight: Math.round(token.size * token.lineHeight),
    }),
    ...(token.letterSpacing !== undefined && { letterSpacing: token.size * token.letterSpacing }),
    ...(token.uppercase && { textTransform: 'uppercase' }),
  };
}

export const textStyles: Record<TextVariant, TextStyle> = mapValues<
  TextVariant,
  TypeToken,
  TextStyle
>(tokens.type, toTextStyle);

export const TEXT_VARIANTS = Object.keys(tokens.type) as TextVariant[];

export const space: Record<SpaceName, number> = tokens.space;
export const size = tokens.size;
export const radius = tokens.radius.none;
export const borderWidth = tokens.border.width;
