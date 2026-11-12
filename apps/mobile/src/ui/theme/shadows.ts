import type { TextStyle } from 'react-native';

const LENGTH = String.raw`(-?\d+(?:\.\d+)?)(?:px)?`;
const SHADOW = new RegExp(
  String.raw`^${LENGTH}\s+${LENGTH}\s+${LENGTH}\s+(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})$`,
);

export type TextShadow = Required<
  Pick<TextStyle, 'textShadowColor' | 'textShadowOffset' | 'textShadowRadius'>
>;

/**
 * Convertit une ombre CSS (`x y flou couleur`) en ombre de texte React Native.
 * `boxShadow` ne s'applique pas aux textes : on passe par les propriétés `textShadow*`.
 */
export function toTextShadow(css: string): TextShadow {
  const match = SHADOW.exec(css.trim());
  if (!match) {
    throw new Error(`Unsupported text shadow: ${css}`);
  }
  const [, x, y, blur, color] = match;
  return {
    textShadowOffset: { width: Number(x), height: Number(y) },
    textShadowRadius: Number(blur),
    textShadowColor: color ?? '',
  };
}
