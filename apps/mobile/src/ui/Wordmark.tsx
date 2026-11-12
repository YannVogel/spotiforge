import { APP_NAME } from '@spotiforge/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, size, space } from './theme';

/** « SPOTIFORGE » et son point de braise, en tête des écrans principaux. */
export function Wordmark() {
  return (
    <View style={styles.row}>
      <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text variant="wordmark" accessibilityLabel={APP_NAME}>
        {APP_NAME.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Carré : DESIGN.md impose les angles vifs, et la lueur est réservée au bouton principal.
  dot: { width: size.wordmarkDot, height: size.wordmarkDot, backgroundColor: colors.ember },
});
