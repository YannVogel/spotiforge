import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ForgeGlow, HeroTitle, PrimaryButton, Text, Wordmark } from '../../ui';
import { colors, size, space } from '../../ui/theme';
import { OFFLINE_COPY } from '../network/copy';
import { SIGN_IN_COPY } from './copy';

type SignInScreenProps = {
  signingIn: boolean;
  offline: boolean;
  /** Ce qui s'est passé (compte non autorisé, session expirée, refus…), en mots simples. */
  message: string | null;
  onSignIn: () => void;
};

/** Premier écran pour une personne non connectée : une seule action, se connecter avec Spotify. */
export function SignInScreen({ signingIn, offline, message, onSignIn }: SignInScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ForgeGlow pulsing={signingIn} />
      <ScrollView contentContainerStyle={styles.content}>
        <Wordmark />
        <HeroTitle>{SIGN_IN_COPY.hero}</HeroTitle>
        <Text color="textSoft">{SIGN_IN_COPY.intro}</Text>
      </ScrollView>
      <View style={styles.footer}>
        {offline && (
          <Text color="textSoft" style={styles.message} accessibilityLiveRegion="polite">
            {OFFLINE_COPY.signIn}
          </Text>
        )}
        {message && (
          <Text style={styles.message} accessibilityRole="alert">
            {message}
          </Text>
        )}
        <PrimaryButton
          label={SIGN_IN_COPY.signIn}
          disabled={offline}
          loading={signingIn}
          loadingLabel={SIGN_IN_COPY.signingIn}
          onPress={onSignIn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md, gap: space.md },
  message: { textAlign: 'center' },
});
