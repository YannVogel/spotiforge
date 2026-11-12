import { Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton, Text } from '../../ui';
import { borderWidth, colors, size, space } from '../../ui/theme';
import { CREATE_COPY } from './copy';

type ResumeOfferProps = {
  title: string;
  onResume: () => void;
  onDismiss: () => void;
};

/** « Une pièce t'attend sur l'enclume » : reprendre la pièce en cours ou la dernière non envoyée. */
export function ResumeOffer({ title, onResume, onDismiss }: ResumeOfferProps) {
  return (
    <View style={styles.box}>
      <Text color="textSoft">{CREATE_COPY.resume.text(title)}</Text>
      <SecondaryButton
        label={CREATE_COPY.resume.action}
        accessibilityLabel={CREATE_COPY.resume.a11y(title)}
        onPress={onResume}
      />
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismiss}>
        <Text variant="label" color="textSoft">
          {CREATE_COPY.resume.dismiss}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.md,
    padding: space.md,
    borderWidth,
    borderColor: colors.borderWarm,
    backgroundColor: colors.surface,
  },
  dismiss: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'center' },
});
