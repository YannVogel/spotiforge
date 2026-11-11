import { useFonts } from 'expo-font';
import { useEffect } from 'react';

import { FONT_FILES } from './fonts';

/**
 * Charge les polices embarquées. Renvoie `true` quand l'interface peut s'afficher : polices
 * chargées, ou échec du chargement (l'app reste utilisable avec les polices du système).
 */
export function useThemeFonts(): boolean {
  const [loaded, error] = useFonts(FONT_FILES);

  useEffect(() => {
    if (error) {
      console.error('Embedded fonts failed to load, falling back to system fonts', error);
    }
  }, [error]);

  return loaded || error !== null;
}
