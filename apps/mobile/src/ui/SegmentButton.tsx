import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { borderWidth, colors, size } from './theme';

type SegmentButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Choix unique (progression). Sélectionné : bordure et texte `flame`. */
export function SegmentButton({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: SegmentButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
      ]}
    >
      <Text variant="trackTitle" color={segmentTextColor(selected, disabled)}>
        {label}
      </Text>
    </Pressable>
  );
}

function segmentTextColor(selected: boolean, disabled: boolean) {
  if (selected) return 'flame';
  return disabled ? 'textMuted' : 'textSoft';
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: size.segmentHeight,
    minWidth: size.touchMin,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { borderColor: colors.border },
  selected: { borderColor: colors.flame },
  pressed: { backgroundColor: colors.surfaceHot },
});
