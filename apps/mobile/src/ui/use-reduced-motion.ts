import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Réglage système « réduire les animations » : les changements d'état deviennent instantanés. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => {
        // Réglage illisible : on garde les animations, sans conséquence fonctionnelle.
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
