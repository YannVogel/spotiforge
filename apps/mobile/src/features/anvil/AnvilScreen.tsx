import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PieceRecord } from '../../domain/history';
import { hotTracks, quenchedCount } from '../../domain/piece';
import { HeroTitle, PrimaryButton, SecondaryButton, Text, TrackRow } from '../../ui';
import { borderWidth, colors, gradients, size, space } from '../../ui/theme';
import { ANVIL_COPY } from './copy';

type AnvilScreenProps = {
  record: PieceRecord;
  onToggleQuench: (spotifyUri: string) => void;
  onBack: () => void;
  /** Remplace les titres à chaud (#37). */
  onReforge: () => void;
  /** Crée la playlist sur le compte (#40). */
  onSend: () => void;
};

/** « Sur l'enclume » : la pièce forgée, titre par titre, à chaud ou trempé. */
export function AnvilScreen({
  record,
  onToggleQuench,
  onBack,
  onReforge,
  onSend,
}: AnvilScreenProps) {
  const hot = hotTracks(record).length;
  const quenched = quenchedCount(record);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Lueur de la forge en haut d'écran, décorative. */}
      <View style={styles.glow} pointerEvents="none" accessibilityElementsHidden />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ANVIL_COPY.backA11y}
            onPress={onBack}
            style={styles.back}
          >
            <View style={styles.chevron} />
            <Text variant="label">{ANVIL_COPY.back}</Text>
          </Pressable>
          <Text variant="wordmark" color="emberSoft" accessibilityRole="header">
            {ANVIL_COPY.heading.toUpperCase()}
          </Text>
        </View>
        <HeroTitle variant="title">{record.title}</HeroTitle>
        <Text color="textSoft">{record.description}</Text>
        <View style={styles.legend}>
          <Text variant="meta" color="textSoft" style={styles.legendText}>
            <Text variant="meta" color="flame">
              {ANVIL_COPY.legendHot}
            </Text>
            {ANVIL_COPY.legendHotText}
            {'\n'}
            <Text variant="meta" color="steel">
              {ANVIL_COPY.legendQuenched}
            </Text>
            {ANVIL_COPY.legendQuenchedText}
          </Text>
          <Text variant="value" color="steel" accessibilityLiveRegion="polite">
            {ANVIL_COPY.quenchedCount(quenched).toUpperCase()}
          </Text>
        </View>
        <View style={styles.list}>
          {record.tracks.map((track, index) => (
            <TrackRow
              key={track.spotifyUri}
              number={index + 1}
              title={track.title}
              meta={ANVIL_COPY.meta(track.artist, track.year, track.known)}
              reason={track.reason}
              quenched={track.quenched}
              onToggleQuench={() => onToggleQuench(track.spotifyUri)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <SecondaryButton
          label={hot > 0 ? ANVIL_COPY.reforge(hot) : ANVIL_COPY.allQuenched}
          disabled={hot === 0}
          onPress={onReforge}
        />
        <PrimaryButton label={ANVIL_COPY.send} onPress={onSend} />
      </View>
    </SafeAreaView>
  );
}

const CHEVRON = space.md;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '40%',
    backgroundImage: gradients.anvilGlow,
  },
  content: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  header: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Chevron « < » dessiné par deux bordures d'un carré tourné : pas d'icône à embarquer.
  chevron: {
    width: CHEVRON,
    height: CHEVRON,
    borderLeftWidth: borderWidth * 2,
    borderBottomWidth: borderWidth * 2,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
    borderWidth,
    borderColor: colors.borderWarm,
    backgroundColor: colors.surface,
  },
  legendText: { flex: 1 },
  list: { gap: space.sm },
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md, gap: space.md },
});
