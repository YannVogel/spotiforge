import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';

/**
 * Retour haptique léger de la trempe (docs/DESIGN.md, « Mouvement »). Sans effet s'il échoue,
 * qu'il rejette ou qu'il lève tout de suite : la trempe n'en dépend jamais.
 */
export function quenchHaptic(): void {
  try {
    impactAsync(ImpactFeedbackStyle.Light).catch(ignoreHapticFailure);
  } catch (error) {
    ignoreHapticFailure(error);
  }
}

function ignoreHapticFailure(_error: unknown): void {
  // Appareil sans moteur haptique, retour désactivé ou module absent : rien à signaler.
}
