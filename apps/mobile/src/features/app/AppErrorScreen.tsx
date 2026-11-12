import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeroTitle, PrimaryButton, Text, Wordmark } from '../../ui';
import { colors, size, space } from '../../ui/theme';

export const APP_ERROR_COPY = {
  hero: 'La forge\na calé',
  text: 'Quelque chose s’est mal passé dans l’app. Tes pièces et tes moules sont gardés sur le téléphone : réessaie.',
  retry: 'Réessayer',
} as const;

type AppErrorScreenProps = { onRetry: () => void };

/** Barrière d'erreur globale : jamais d'écran blanc, toujours un moyen de repartir. */
export function AppErrorScreen({ onRetry }: AppErrorScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Wordmark />
        <HeroTitle>{APP_ERROR_COPY.hero}</HeroTitle>
        <Text color="textSoft" accessibilityRole="alert">
          {APP_ERROR_COPY.text}
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label={APP_ERROR_COPY.retry} onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: size.screenPadding, paddingTop: space.md, gap: space.xl },
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md },
});
