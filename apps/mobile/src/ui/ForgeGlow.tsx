import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { gradients } from './theme';
import { useReducedMotion } from './use-reduced-motion';

/** Une demi-pulsation : la lueur baisse puis remonte en deux fois cette durée. */
export const PULSE_HALF_MS = 900;
const DIMMED = 0.45;

type ForgeGlowProps = {
  /** Forge en cours : la lueur pulse (docs/DESIGN.md, « Mouvement »). */
  pulsing: boolean;
};

/** Lueur du foyer en bas d'écran, décorative : elle ne capte ni le toucher ni les lecteurs d'écran. */
export function ForgeGlow({ pulsing }: ForgeGlowProps) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!pulsing || reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence(
        [DIMMED, 1].map((toValue) =>
          Animated.timing(opacity, {
            toValue,
            duration: PULSE_HALF_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ),
      ),
    );
    pulse.start();
    return () => {
      pulse.stop();
      opacity.setValue(1);
    };
  }, [pulsing, reducedMotion, opacity]);

  return (
    <Animated.View
      testID="forge-glow"
      style={[styles.glow, { opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundImage: gradients.forgeGlow,
  },
});
