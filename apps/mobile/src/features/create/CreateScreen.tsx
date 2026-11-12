import { FORGE_LIMITS } from '@spotiforge/shared';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { canForge } from '../../domain/draft';
import {
  AlloySwitch,
  ForgeGlow,
  HeroTitle,
  OreField,
  PrimaryButton,
  SecondaryButton,
  Text,
  Wordmark,
} from '../../ui';
import { colors, size, space } from '../../ui/theme';
import { useDraftStore } from '../draft/draft-store';
import { FORGE_COPY, failureText, progressText } from '../forge/copy';
import type { ForgeState } from '../forge/forge-store';
import { useAlloyStore } from '../taste/taste-store';
import { CREATE_COPY } from './copy';
import { ResumeOffer } from './ResumeOffer';
import { DecadeChoices, DiscoverySetting, LengthSetting, ShapeChoices } from './settings';

type CreateScreenProps = {
  forge: ForgeState;
  /** Pièce à reprendre sur l'enclume, s'il y en a une. */
  resume: { title: string } | null;
  onResume: () => void;
  onDismissResume: () => void;
  /** Lance la forge depuis le brouillon (ou la relance après un échec). */
  onForge: () => void;
  onCancelForge: () => void;
  onOpenPieces: () => void;
};

/** « Qu'est-ce qu'on forge ? » : le minerai et les réglages, branchés sur le brouillon. */
export function CreateScreen({
  forge,
  resume,
  onResume,
  onDismissResume,
  onForge,
  onCancelForge,
  onOpenPieces,
}: CreateScreenProps) {
  const store = useDraftStore();
  const { draft } = store;
  const alloyUnavailable = useAlloyStore((state) => state.availability === 'unavailable');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ForgeGlow pulsing={forge.status === 'forging'} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.header}>
            <Wordmark />
            <Pressable accessibilityRole="button" onPress={onOpenPieces} style={styles.piecesLink}>
              <Text variant="label" color="textSoft">
                {CREATE_COPY.pieces}
              </Text>
            </Pressable>
          </View>
          {resume && forge.status !== 'forging' && (
            <ResumeOffer title={resume.title} onResume={onResume} onDismiss={onDismissResume} />
          )}
          <HeroTitle>{CREATE_COPY.hero}</HeroTitle>
          <OreField
            label={CREATE_COPY.ore}
            value={draft.prompt}
            onChangeText={store.setPrompt}
            maxLength={FORGE_LIMITS.prompt.maxLength}
          />
          <View style={styles.alloy}>
            <AlloySwitch
              label={CREATE_COPY.alloy}
              value={draft.settings.useTaste && !alloyUnavailable}
              onValueChange={store.setUseTaste}
              disabled={alloyUnavailable}
            />
            {alloyUnavailable && (
              <Text variant="meta" color="textMuted">
                {CREATE_COPY.alloyUnavailable}
              </Text>
            )}
          </View>
          <LengthSetting length={draft.settings.length} onChange={store.setLengthValue} />
          <DiscoverySetting discovery={draft.settings.discovery} onChange={store.setDiscovery} />
          <DecadeChoices selected={draft.settings.decades} onToggle={store.toggleDecade} />
          <ShapeChoices shape={draft.settings.shape} onSelect={store.setShape} />
        </ScrollView>
        <View style={styles.footer}>
          {forge.status === 'forging' && (
            <Text color="textSoft" style={styles.status} accessibilityLiveRegion="polite">
              {progressText(forge.progress)}
            </Text>
          )}
          {forge.status === 'failed' && (
            <Text color="text" style={styles.status} accessibilityRole="alert">
              {failureText(forge.failure)}
            </Text>
          )}
          <PrimaryButton
            label={forge.status === 'failed' ? FORGE_COPY.retry : CREATE_COPY.forge}
            loading={forge.status === 'forging'}
            loadingLabel={FORGE_COPY.forging}
            disabled={!canForge(draft)}
            onPress={onForge}
          />
          {forge.status === 'forging' && (
            <SecondaryButton label={FORGE_COPY.cancel} onPress={onCancelForge} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alloy: { gap: space.xs },
  piecesLink: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center' },
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md, gap: space.md },
  status: { textAlign: 'center' },
});
