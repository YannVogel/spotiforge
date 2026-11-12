import { Pressable, StyleSheet, View } from 'react-native';

import { QuenchButton } from './QuenchButton';
import { Text } from './Text';
import { borderWidth, colors, glows, size, space } from './theme';

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
  return (
    <View
      style={[styles.row, quenched ? styles.cold : styles.hot, pending && styles.pending]}
      accessibilityState={{ busy: pending }}
    >
      <Pressable
        accessibilityRole={onPress ? 'link' : undefined}
        accessibilityLabel={pressLabel}
        disabled={!onPress}
        onPress={onPress}
        style={styles.body}
      >
        <Text
          variant="trackNumber"
          color={quenched ? 'steel' : 'flame'}
          style={[styles.number, !quenched && glows.hotNumber]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {number}
        </Text>
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
    </View>
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
  hot: { backgroundColor: colors.surfaceHot, borderColor: colors.borderHot, ...glows.hotRow },
  cold: { backgroundColor: colors.surfaceCold, borderColor: colors.borderCold },
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
