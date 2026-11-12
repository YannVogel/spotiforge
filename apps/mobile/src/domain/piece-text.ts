import { FORGE_LIMITS } from '@spotiforge/shared';

function clean(text: string, maxLength: number): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

/** Titre de pièce nettoyé, ou `null` s'il est vide : une playlist garde toujours un nom. */
export function cleanPieceTitle(title: string): string | null {
  const cleaned = clean(title, FORGE_LIMITS.title.maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/** Description nettoyée, sur une ligne (Spotify l'affiche ainsi) ; elle peut rester vide. */
export function cleanPieceDescription(description: string): string {
  return clean(description, FORGE_LIMITS.description.maxLength);
}
