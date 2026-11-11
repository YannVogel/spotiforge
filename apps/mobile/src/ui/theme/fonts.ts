// Les fichiers fournis dans design/ sont en WOFF2, que React Native ne lit pas sur Android :
// on charge les TTF des mêmes polices (OFL 1.1), une graisse par fichier, sans réseau.
import type { FontRole } from './tokens';

/** Nom de famille par rôle et par graisse, tel que déclaré auprès d'`expo-font`. */
export const FONT_FAMILIES: Record<FontRole, Partial<Record<number, string>>> = {
  display: {
    700: 'BigShouldersDisplay-Bold',
    900: 'BigShouldersDisplay-Black',
  },
  body: {
    400: 'Barlow-Regular',
    500: 'Barlow-Medium',
    600: 'Barlow-SemiBold',
  },
};

/** Fichiers à charger avant le premier rendu (`useFonts`). */
export const FONT_FILES: Record<string, number> = {
  'BigShouldersDisplay-Bold': require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_700Bold.ttf'),
  'BigShouldersDisplay-Black': require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf'),
  'Barlow-Regular': require('@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf'),
  'Barlow-Medium': require('@expo-google-fonts/barlow/500Medium/Barlow_500Medium.ttf'),
  'Barlow-SemiBold': require('@expo-google-fonts/barlow/600SemiBold/Barlow_600SemiBold.ttf'),
};

export function fontFamily(role: string, weight: number): string {
  const family = FONT_FAMILIES[role as FontRole]?.[weight];
  if (!family) {
    throw new Error(`No embedded font for role "${role}" and weight ${weight}`);
  }
  return family;
}
