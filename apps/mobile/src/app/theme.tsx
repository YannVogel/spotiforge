import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../ui/Text';
import { colors, space, size, TEXT_VARIANTS, type TextVariant } from '../ui/theme';

// Textes tirés des maquettes Braise.
const SAMPLES: Record<TextVariant, string> = {
  hero: 'Qu’est-ce qu’on forge ?',
  title: 'Sur l’enclume',
  cta: 'Forger la playlist',
  trackNumber: '04',
  value: '40 min',
  chip: '80s',
  wordmark: 'Spotiforge',
  body: 'Route de nuit au bord de la mer. Synthés mélancoliques, voix lointaines.',
  trackTitle: 'Nightcall',
  meta: 'Kavinsky · 2010 · connu',
  label: 'Le minerai — ton moment',
};

/** Écran de démonstration du thème (développement seulement) : `spotiforge://theme`. */
export default function ThemeDemoScreen() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {TEXT_VARIANTS.map((variant) => (
          <View key={variant} style={styles.sample}>
            <Text variant="meta" color="textMuted">
              {variant}
            </Text>
            <Text variant={variant}>{SAMPLES[variant]}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: size.screenPadding, gap: space.xxl },
  sample: { gap: space.xs },
});
