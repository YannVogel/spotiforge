import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { borderWidth, colors, size } from './theme';

type QuenchButtonProps = {
  quenched: boolean;
  /** Titre du morceau, pour le libellé lu : « Tremper Nightcall ». */
  trackTitle: string;
  onPress: () => void;
  disabled?: boolean;
};

export const QUENCH_LABELS = {
  hot: 'Tremper',
  quenched: 'Trempé',
  a11yQuench: (title: string) => `Tremper ${title}`,
  a11yUnquench: (title: string) => `Remettre au feu ${title}`,
} as const;

/**
 * « Tremper » / « Trempé ». À chaud : contour `ember` ; trempé : plein `steel`. L'état se lit
 * aussi au texte du bouton, pas seulement à sa couleur (docs/DESIGN.md).
 */
export function QuenchButton({
  quenched,
  trackTitle,
  onPress,
  disabled = false,
}: QuenchButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        quenched ? QUENCH_LABELS.a11yUnquench(trackTitle) : QUENCH_LABELS.a11yQuench(trackTitle)
      }
      accessibilityState={{ selected: quenched, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={(size.touchMin - size.quenchButton.height) / 2}
      style={[styles.base, quenched ? styles.quenched : styles.hot]}
    >
      <Text variant="chip" color={quenched ? 'onEmber' : 'flame'}>
        {(quenched ? QUENCH_LABELS.quenched : QUENCH_LABELS.hot).toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: size.quenchButton.width,
    height: size.quenchButton.height,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hot: { borderColor: colors.ember },
  quenched: { borderColor: colors.steel, backgroundColor: colors.steel },
});
