import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { borderWidth, colors, size } from './theme';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Choix multiple (époques). Sélectionné : fond `ember`. */
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
    >
      <Text variant="chip" color={chipTextColor(selected, disabled)}>
        {label}
      </Text>
    </Pressable>
  );
}

function chipTextColor(selected: boolean, disabled: boolean) {
  if (selected) return 'onEmber';
  return disabled ? 'textMuted' : 'textSoft';
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: size.touchMin,
    minWidth: size.touchMin,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { borderColor: colors.border },
  selected: { borderColor: colors.ember, backgroundColor: colors.ember },
  pressed: { backgroundColor: colors.surfaceHot },
});
