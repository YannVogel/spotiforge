import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { colors, glows, size, space } from './theme';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Action en cours : le bouton ne répond plus et le signale aux lecteurs d'écran. */
  loading?: boolean;
  /** Libellé affiché pendant `loading` (sinon `label`). */
  loadingLabel?: string;
  /** Libellé lu par les lecteurs d'écran, si `label` ne suffit pas. */
  accessibilityLabel?: string;
};

/** Action principale : fond `ember`, seul élément qui porte le halo `cta`. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  accessibilityLabel,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        disabled ? styles.disabled : styles.enabled,
        pressed && styles.pressed,
      ]}
    >
      <Text variant="cta" color={disabled ? 'textMuted' : 'onEmber'} style={styles.label}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Un libellé long (« Se connecter avec Spotify ») passe sur deux lignes, centrées.
  label: { textAlign: 'center' },
  base: {
    minHeight: size.ctaHeight,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enabled: { backgroundColor: colors.ember, ...glows.cta },
  // Éteint : ni braise ni halo.
  disabled: { backgroundColor: colors.track },
  pressed: { backgroundColor: colors.emberSoft },
});
