import { APP_NAME } from '@spotiforge/shared';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return <View style={styles.screen} accessibilityLabel={APP_NAME} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
