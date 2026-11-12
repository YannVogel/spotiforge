import { Pressable, StyleSheet } from 'react-native';

import type { ButtonProps } from './PrimaryButton';
import { Text } from './Text';
import { borderWidth, colors, size, space } from './theme';

/** Action secondaire (Reforger) : contour `ember`, texte `flame`, sans halo. */
export function SecondaryButton({
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
      <Text variant="cta" color={disabled ? 'textMuted' : 'flame'}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.secondaryHeight,
    paddingHorizontal: space.lg,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enabled: { borderColor: colors.ember },
  disabled: { borderColor: colors.border },
  pressed: { backgroundColor: colors.surfaceHot },
});
