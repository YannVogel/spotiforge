import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from './Text';
import { borderWidth, colors, space, textStyles } from './theme';

type OreFieldProps = {
  /** Libellé visible et lu par les lecteurs d'écran (« Le minerai — ton moment »). */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  editable?: boolean;
  /** Lignes visibles (4 pour le minerai). */
  lines?: number;
};

/** Zone de saisie Braise : le minerai (le prompt), et les textes d'une pièce. Bordure `ember` pendant la saisie. */
export function OreField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  editable = true,
  lines = 4,
}: OreFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.box, focused && styles.focused]}>
      <Text
        variant="label"
        color="emberSoft"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={maxLength}
        editable={editable}
        multiline
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        cursorColor={colors.ember}
        selectionColor={colors.ember}
        style={[styles.input, { height: (textStyles.body.lineHeight ?? 0) * lines }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth,
    borderColor: colors.borderWarm,
  },
  focused: { borderColor: colors.ember },
  input: {
    ...textStyles.body,
    color: colors.text,
    padding: 0,
  },
});
