import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { borderWidth, colors, size } from './theme';

type AlloySwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

const { width, height, thumbWidth, thumbHeight } = size.alloySwitch;
const inset = (height - 2 * borderWidth - thumbHeight) / 2;

/** Interrupteur carré (« Alliage : mes écoutes ») ; toute la ligne est la zone tactile. */
export function AlloySwitch({ label, value, onValueChange, disabled = false }: AlloySwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <Text color={disabled ? 'textMuted' : 'text'}>{label}</Text>
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: { width, height, borderWidth, padding: inset, flexDirection: 'row' },
  trackOn: {
    borderColor: colors.ember,
    backgroundColor: colors.surfaceHot,
    justifyContent: 'flex-end',
  },
  trackOff: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'flex-start',
  },
  thumb: { width: thumbWidth, height: thumbHeight },
  thumbOn: { backgroundColor: colors.ember },
  thumbOff: { backgroundColor: colors.textMuted },
});
