import { FORGE_LIMITS, type ForgeRequest } from '@spotiforge/shared';

/** Minutes par titre pour estimer le nombre de titres d'une longueur en minutes (docs/GENERATION.md). */
export const MINUTES_PER_TRACK = 4;
/** Marge de candidats pour absorber les titres introuvables au catalogue. */
export const CANDIDATE_MARGIN = 1.5;

export type ForgePlan = {
  /** Nombre de candidats à demander au modèle. */
  candidateCount: number;
  /** Nombre de titres visés dans la pièce. */
  totalPositions: number;
  /** Positions (à partir de 0) à remplir : toutes, ou celles que `keep` laisse libres. */
  freePositions: number[];
};

export function planForge(request: ForgeRequest): ForgePlan {
  const { length } = request;
  const target =
    length.unit === 'tracks' ? length.value : Math.ceil(length.value / MINUTES_PER_TRACK);
  const kept = new Set((request.keep ?? []).map((track) => track.position));
  const totalPositions = Math.max(target, ...[...kept].map((position) => position + 1));
  const freePositions = Array.from({ length: totalPositions }, (_, position) => position).filter(
    (position) => !kept.has(position),
  );
  // Au moins un candidat : une reforge sans place libre ne devrait pas arriver jusqu'ici.
  const wanted = Math.ceil(Math.max(freePositions.length, 1) * CANDIDATE_MARGIN);
  return {
    candidateCount: Math.min(wanted, FORGE_LIMITS.candidates.max),
    totalPositions,
    freePositions,
  };
}
