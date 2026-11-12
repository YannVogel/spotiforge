import { useEffect, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { borderWidth, colors, glows, gradients, size } from '../theme';
import { fillRatio, type Range, stepValue, valueFromPosition } from './heat-bar-math';

type HeatBarProps = Range & {
  value: number;
  onChange: (value: number) => void;
  /** Ce que règle la barre, en mots simples (« Durée en minutes »). */
  accessibilityLabel: string;
  /** Valeur lue par les lecteurs d'écran (« 40 minutes »). Par défaut, le nombre seul. */
  accessibilityValueText?: string;
};

const ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];

/** Curseur en barre chauffée : on glisse ou on appuie directement sur la barre. */
export function HeatBar({
  min,
  max,
  step,
  value,
  onChange,
  accessibilityLabel,
  accessibilityValueText,
}: HeatBarProps) {
  const range = { min, max, step };
  const [width, setWidth] = useState(0);
  // Pendant un glissement, plusieurs mouvements arrivent avant que `value` ne revienne du parent :
  // on retient la dernière valeur émise pour ne pas la renvoyer en double.
  const lastEmitted = useRef(value);
  useEffect(() => {
    lastEmitted.current = value;
  }, [value]);

  const emit = (next: number) => {
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChange(next);
  };

  const handleTouch = (event: GestureResponderEvent) =>
    emit(valueFromPosition(event.nativeEvent.locationX, width, range));

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent;
    if (actionName === 'increment') emit(stepValue(value, 1, range));
    if (actionName === 'decrement') emit(stepValue(value, -1, range));
  };

  const ratio = fillRatio(value, range);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: accessibilityValueText }}
      accessibilityActions={ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Une fois saisie, la barre garde le geste (pas de défilement de l'écran en plein réglage).
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      style={styles.touchArea}
    >
      {/* Les enfants ne captent pas le toucher : `locationX` reste mesuré sur toute la barre. */}
      <View style={styles.bar} pointerEvents="none">
        <View style={styles.rail} />
        {ratio > 0 && (
          <View testID="heat-bar-fill" style={[styles.fill, { width: `${ratio * 100}%` }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: { height: size.touchMin, justifyContent: 'center' },
  bar: { height: size.heatBarHeight },
  rail: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.track,
    borderWidth,
    borderColor: colors.border,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundImage: gradients.heatBar,
    ...glows.heatBar,
  },
});
