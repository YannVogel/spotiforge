import { FORGE_LIMITS } from '@spotiforge/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PieceRecord } from '../../domain/history';
import { hotTracks, quenchedCount } from '../../domain/piece';
import { HeroTitle, OreField, PrimaryButton, SecondaryButton, Text, TrackRow } from '../../ui';
import { borderWidth, colors, gradients, size, space } from '../../ui/theme';
import { failureText } from '../forge/copy';
import type { ReforgeState } from './anvil-store';
import { ANVIL_COPY } from './copy';

type AnvilScreenProps = {
  record: PieceRecord;
  reforge: ReforgeState;
  onToggleQuench: (spotifyUri: string) => void;
  onRename: (title: string, description: string) => void;
  /** Écouter un titre (ouverture dans Spotify). */
  onOpenTrack: (spotifyUri: string) => void;
  onBack: () => void;
  /** Remplace les titres à chaud (#37). */
  onReforge: () => void;
  /** Crée la playlist sur le compte (#40). */
  onSend: () => void;
};

/** « Sur l'enclume » : la pièce forgée, titre par titre, à chaud ou trempé. */
export function AnvilScreen({
  record,
  reforge,
  onToggleQuench,
  onRename,
  onOpenTrack,
  onBack,
  onReforge,
  onSend,
}: AnvilScreenProps) {
  const hot = hotTracks(record).length;
  const quenched = quenchedCount(record);
  const reforging = reforge.status === 'reforging';

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
        <PieceDetails
          title={record.title}
          description={record.description}
          editable={!reforging}
          onRename={onRename}
        />
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
              pending={reforging && !track.quenched}
              disabled={reforging}
              onToggleQuench={() => onToggleQuench(track.spotifyUri)}
              onPress={() => onOpenTrack(track.spotifyUri)}
              pressLabel={ANVIL_COPY.listen(track.title)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {reforge.status === 'failed' && (
          <Text style={styles.status} accessibilityRole="alert">
            {failureText(reforge.failure)}
          </Text>
        )}
        <SecondaryButton
          label={hot > 0 ? ANVIL_COPY.reforge(hot) : ANVIL_COPY.allQuenched}
          disabled={hot === 0}
          loading={reforging}
          loadingLabel={ANVIL_COPY.reforging}
          onPress={onReforge}
        />
        <PrimaryButton label={ANVIL_COPY.send} disabled={reforging} onPress={onSend} />
      </View>
    </SafeAreaView>
  );
}

type PieceDetailsProps = {
  title: string;
  description: string;
  editable: boolean;
  onRename: (title: string, description: string) => void;
};

/** Titre et description de la pièce, écrits par l'IA, modifiables à la main. */
function PieceDetails({ title, description, editable, onRename }: PieceDetailsProps) {
  const [draft, setDraft] = useState<{ title: string; description: string } | null>(null);

  if (!draft) {
    return (
      <>
        <HeroTitle variant="title">{title}</HeroTitle>
        <Text color="textSoft">{description}</Text>
        {editable && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setDraft({ title, description })}
            style={styles.link}
          >
            <Text variant="label" color="textSoft">
              {ANVIL_COPY.edit}
            </Text>
          </Pressable>
        )}
      </>
    );
  }

  return (
    <View style={styles.editor}>
      <OreField
        label={ANVIL_COPY.titleField}
        value={draft.title}
        onChangeText={(value) => setDraft({ ...draft, title: value })}
        maxLength={FORGE_LIMITS.title.maxLength}
        lines={2}
      />
      <OreField
        label={ANVIL_COPY.descriptionField}
        value={draft.description}
        onChangeText={(value) => setDraft({ ...draft, description: value })}
        maxLength={FORGE_LIMITS.description.maxLength}
        lines={3}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onRename(draft.title, draft.description);
          setDraft(null);
        }}
        style={styles.link}
      >
        <Text variant="label" color="flame">
          {ANVIL_COPY.editDone}
        </Text>
      </Pressable>
    </View>
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
  link: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
  editor: { gap: space.md },
  list: { gap: space.sm },
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md, gap: space.md },
  status: { textAlign: 'center' },
});
