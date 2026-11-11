import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { type ColorName, colors, type TextVariant, textStyles } from './theme';

export type TextProps = NativeTextProps & {
  /** Style nommé de `design/tokens.json` (`hero`, `title`, `label`…). */
  variant?: TextVariant;
  color?: ColorName;
};

export function Text({ variant = 'body', color = 'text', style, ...props }: TextProps) {
  return <NativeText {...props} style={[textStyles[variant], { color: colors[color] }, style]} />;
}
