import { FORGE_LIMITS, type ForgeRequest } from '@spotiforge/shared';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { canForge, toForgeRequest } from '../../domain/draft';
import { AlloySwitch, HeroTitle, OreField, PrimaryButton, Text, Wordmark } from '../../ui';
import { colors, gradients, size, space } from '../../ui/theme';
import { useDraftStore } from '../draft/draft-store';
import { useAlloyStore } from '../taste/taste-store';
import { CREATE_COPY } from './copy';
import { DecadeChoices, DiscoverySetting, LengthSetting, ShapeChoices } from './settings';

type CreateScreenProps = {
  /** Lance la forge avec la requête construite depuis le brouillon. */
  onForge: (request: ForgeRequest) => void;
  onOpenPieces: () => void;
};

/** « Qu'est-ce qu'on forge ? » : le minerai et les réglages, branchés sur le brouillon. */
export function CreateScreen({ onForge, onOpenPieces }: CreateScreenProps) {
  const store = useDraftStore();
  const { draft } = store;
  const alloyUnavailable = useAlloyStore((state) => state.availability === 'unavailable');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Lueur du foyer, décorative : elle ne capte ni le toucher ni les lecteurs d'écran. */}
      <View style={styles.forgeGlow} pointerEvents="none" accessibilityElementsHidden />
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
          <PrimaryButton
            label={CREATE_COPY.forge}
            disabled={!canForge(draft)}
            onPress={() => onForge(toForgeRequest(draft))}
          />
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
  footer: { paddingHorizontal: size.screenPadding, paddingVertical: space.md },
  forgeGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundImage: gradients.forgeGlow,
  },
});
