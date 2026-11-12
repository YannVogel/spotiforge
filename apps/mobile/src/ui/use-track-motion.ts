import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotion } from './use-reduced-motion';

/** Le titre passe du chaud au froid en 300 ms environ (docs/DESIGN.md). */
export const QUENCH_MS = 300;
/** Embrasement d'un titre à chaud au départ d'une reforge, avant son remplacement. */
export const FLARE_MS = 450;

/**
 * Animations d'un titre : `heat` va de 1 (à chaud) à 0 (trempé), `flare` monte puis retombe au
 * départ d'une reforge. Avec la réduction des animations, les valeurs changent instantanément.
 * L'état (texte, boutons) ne dépend jamais de la fin d'une animation.
 */
export function useTrackMotion(quenched: boolean, pending: boolean) {
  const reducedMotion = useReducedMotion();
  const [heat] = useState(() => new Animated.Value(quenched ? 0 : 1));
  const [flare] = useState(() => new Animated.Value(0));
  const previous = useRef(quenched);

  useEffect(() => {
    const target = quenched ? 0 : 1;
    if (previous.current === quenched) return;
    previous.current = quenched;
    if (reducedMotion) {
      heat.setValue(target);
      return;
    }
    const animation = Animated.timing(heat, {
      toValue: target,
      duration: QUENCH_MS,
      easing: Easing.out(Easing.quad),
      // Couleurs interpolées : pas de pilote natif.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [quenched, reducedMotion, heat]);

  useEffect(() => {
    if (!pending || reducedMotion) {
      flare.setValue(0);
      return;
    }
    const animation = Animated.sequence(
      [1, 0].map((toValue) =>
        Animated.timing(flare, {
          toValue,
          duration: FLARE_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [pending, reducedMotion, flare]);

  return { heat, flare };
}
