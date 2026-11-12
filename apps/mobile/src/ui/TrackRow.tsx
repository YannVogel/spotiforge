import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { QuenchButton } from './QuenchButton';
import { Text } from './Text';
import { borderWidth, colors, glows, size, space, textStyles } from './theme';
import { useTrackMotion } from './use-track-motion';

export type TrackRowProps = {
  /** Numéro affiché, à partir de 1. */
  number: number;
  title: string;
  /** « Artiste · 2010 · connu », déjà composé par l'écran. */
  meta: string;
  /** « Pourquoi ce titre ». */
  reason: string;
  quenched: boolean;
  onToggleQuench: () => void;
  /** Appui sur le titre (hors bouton), par exemple pour l'écouter. */
  onPress?: () => void;
  /** Libellé lu pour `onPress` : « Écouter Nightcall dans Spotify ». */
  pressLabel?: string;
  disabled?: boolean;
  /** Titre à chaud en cours de remplacement (reforge) : estompé, bouton figé. */
  pending?: boolean;
};

/** Un titre en cours de remplacement s'estompe, sans changer de couleur. */
const PENDING_OPACITY = 0.4;
/** Intensité maximale de l'embrasement d'un titre à la reforge. */
const FLARE_OPACITY = 0.35;

/**
 * Un titre sur l'enclume. À chaud : fond `surfaceHot`, bordure `borderHot`, lueur intérieure,
 * numéro `flame` lumineux. Trempé : fond `surfaceCold`, bordure `borderCold`, numéro `steel`.
 */
export function TrackRow({
  number,
  title,
  meta,
  reason,
  quenched,
  onToggleQuench,
  onPress,
  pressLabel,
  disabled = false,
  pending = false,
}: TrackRowProps) {
  const { heat, flare } = useTrackMotion(quenched, pending);
  const between = (cold: string, hot: string) =>
    heat.interpolate({ inputRange: [0, 1], outputRange: [cold, hot] });

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: between(colors.surfaceCold, colors.surfaceHot),
          borderColor: between(colors.borderCold, colors.borderHot),
        },
        pending && styles.pending,
      ]}
      accessibilityState={{ busy: pending }}
    >
      {/* Lueur intérieure du métal chaud, qui s'éteint à la trempe. */}
      <Animated.View pointerEvents="none" style={[styles.layer, glows.hotRow, { opacity: heat }]} />
      {/* Embrasement au départ d'une reforge. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          styles.flare,
          { opacity: flare.interpolate({ inputRange: [0, 1], outputRange: [0, FLARE_OPACITY] }) },
        ]}
      />
      <Pressable
        accessibilityRole={onPress ? 'link' : undefined}
        accessibilityLabel={pressLabel}
        disabled={!onPress}
        onPress={onPress}
        style={styles.body}
      >
        <Animated.Text
          style={[
            textStyles.trackNumber,
            styles.number,
            { color: between(colors.steel, colors.flame) },
            !quenched && glows.hotNumber,
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {number}
        </Animated.Text>
        <View style={styles.texts}>
          <Text variant="trackTitle">{title}</Text>
          <Text variant="meta" color="textMuted">
            {meta}
          </Text>
          <Text variant="meta" color="textSoft">
            {reason}
          </Text>
        </View>
      </Pressable>
      <QuenchButton
        quenched={quenched}
        trackTitle={title}
        onPress={onToggleQuench}
        disabled={disabled || pending}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth,
  },
  layer: StyleSheet.absoluteFill,
  flare: { backgroundColor: colors.ember },
  pending: { opacity: PENDING_OPACITY },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  // La marge intérieure laisse la place à la lueur du numéro, sinon rognée au bord du texte ;
  // la marge négative la compense dans la mise en page.
  number: {
    width: size.trackNumberWidth + 2 * space.lg,
    padding: space.lg,
    margin: -space.lg,
    textAlign: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: space.xs },
});
