import type { Candidate, Decade, ForgeRequest, TrackRef } from '@spotiforge/shared';

// La normalisation et la correspondance sont celles de l'app (code pur du domaine) : l'évaluation
// mesure ce que l'app garderait vraiment.
import type { CatalogTrack } from '../../mobile/src/domain/match';
import { normalizeArtistName } from '../../mobile/src/domain/normalize';
import { resolutionKey } from '../../mobile/src/domain/resolution-cache';

/** docs/GENERATION.md : pas plus de deux titres par artiste. */
export const MAX_TRACKS_PER_ARTIST = 2;
/** Critère de l'issue #26 : au moins quatre titres proposés sur cinq existent sur Spotify. */
export const MIN_FOUND_SHARE = 0.8;

const DECADE_START: Record<Decade, number> = {
  '60s': 1960,
  '70s': 1970,
  '80s': 1980,
  '90s': 1990,
  '00s': 2000,
  '10s': 2010,
  '20s': 2020,
};

/** Un candidat et la version retenue sur Spotify par la correspondance de l'app (`null` : introuvable). */
export type CandidateCheck = { candidate: Candidate; match: CatalogTrack | null };

export type Ratio = { matching: number; total: number };

export type CaseMetrics = {
  /** Candidats qui existent sur Spotify. */
  found: Ratio;
  /** Années annoncées par le modèle dans les décennies demandées ; `null` : toutes les époques. */
  candidateYears: Ratio | null;
  /**
   * Années des versions trouvées sur Spotify, dans les décennies demandées. Indicatif : Spotify
   * date souvent la réédition plutôt que l'original.
   */
  spotifyYears: Ratio | null;
  /** Artistes proposés plus de deux fois, avec leur nombre de titres. */
  overusedArtists: { artist: string; count: number }[];
  /** Candidats du même artiste que le précédent, dans l'ordre de la progression. */
  consecutiveRepeats: number;
  /** Candidats déjà proposés (même artiste et même titre normalisés). */
  duplicateTracks: TrackRef[];
  /** Candidats qui reprennent un titre de `avoid` ou de `keep`. */
  avoidViolations: TrackRef[];
};

export function share({ matching, total }: Ratio): number {
  return total === 0 ? 1 : matching / total;
}

export function inDecades(year: number, decades: readonly Decade[]): boolean {
  return decades.some((decade) => year >= DECADE_START[decade] && year < DECADE_START[decade] + 10);
}

function yearsInDecades(years: readonly number[], decades: readonly Decade[]): Ratio | null {
  if (decades.length === 0) return null;
  return {
    matching: years.filter((year) => inDecades(year, decades)).length,
    total: years.length,
  };
}

function trackRef({ artist, title }: TrackRef): TrackRef {
  return { artist, title };
}

function overusedArtists(candidates: readonly Candidate[]) {
  const counts = new Map<string, { artist: string; count: number }>();
  for (const { artist } of candidates) {
    const key = normalizeArtistName(artist);
    const entry = counts.get(key) ?? { artist, count: 0 };
    counts.set(key, { ...entry, count: entry.count + 1 });
  }
  return [...counts.values()].filter(({ count }) => count > MAX_TRACKS_PER_ARTIST);
}

function consecutiveRepeats(candidates: readonly Candidate[]): number {
  const artists = [...candidates]
    .sort((a, b) => a.slot - b.slot)
    .map(({ artist }) => normalizeArtistName(artist));
  return artists.filter((artist, index) => index > 0 && artist === artists[index - 1]).length;
}

function duplicateTracks(candidates: readonly Candidate[]): TrackRef[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = resolutionKey(candidate.artist, candidate.title);
    const duplicate = seen.has(key);
    seen.add(key);
    return duplicate;
  });
}

function avoidViolations(request: ForgeRequest, candidates: readonly Candidate[]): TrackRef[] {
  const forbidden = new Set(
    [...(request.avoid ?? []), ...(request.keep ?? [])].map(({ artist, title }) =>
      resolutionKey(artist, title),
    ),
  );
  return candidates.filter(({ artist, title }) => forbidden.has(resolutionKey(artist, title)));
}

/** Mesures d'une forge d'essai, à partir des candidats et de leur résolution sur Spotify. */
export function measureCase(request: ForgeRequest, checks: readonly CandidateCheck[]): CaseMetrics {
  const candidates = checks.map(({ candidate }) => candidate);
  const matches = checks.flatMap(({ match }) => (match ? [match] : []));
  return {
    found: { matching: matches.length, total: checks.length },
    candidateYears: yearsInDecades(
      candidates.map(({ year }) => year),
      request.decades,
    ),
    spotifyYears: yearsInDecades(
      matches.flatMap(({ year }) => (year === undefined ? [] : [year])),
      request.decades,
    ),
    overusedArtists: overusedArtists(candidates),
    consecutiveRepeats: consecutiveRepeats(candidates),
    duplicateTracks: duplicateTracks(candidates).map(trackRef),
    avoidViolations: avoidViolations(request, candidates).map(trackRef),
  };
}

export type EvalSummary = {
  /** Forges réussies, et forges en échec (sortie invalide, refus, API indisponible). */
  forged: number;
  failed: number;
  found: Ratio;
  candidateYears: Ratio;
  overusedArtists: number;
  consecutiveRepeats: number;
  duplicateTracks: number;
  avoidViolations: number;
  /** Le critère de l'issue est atteint sur l'ensemble du jeu, sans forge en échec. */
  meetsFoundCriterion: boolean;
};

function addRatios(ratios: readonly (Ratio | null)[]): Ratio {
  return ratios.reduce<Ratio>(
    (sum, ratio) =>
      ratio ? { matching: sum.matching + ratio.matching, total: sum.total + ratio.total } : sum,
    { matching: 0, total: 0 },
  );
}

/** Totaux du jeu d'essais ; `failed` compte les forges qui n'ont rien renvoyé. */
export function summarize(metrics: readonly CaseMetrics[], failed: number): EvalSummary {
  const found = addRatios(metrics.map((m) => m.found));
  return {
    forged: metrics.length,
    failed,
    found,
    candidateYears: addRatios(metrics.map((m) => m.candidateYears)),
    overusedArtists: metrics.reduce((sum, m) => sum + m.overusedArtists.length, 0),
    consecutiveRepeats: metrics.reduce((sum, m) => sum + m.consecutiveRepeats, 0),
    duplicateTracks: metrics.reduce((sum, m) => sum + m.duplicateTracks.length, 0),
    avoidViolations: metrics.reduce((sum, m) => sum + m.avoidViolations.length, 0),
    meetsFoundCriterion: failed === 0 && found.total > 0 && share(found) >= MIN_FOUND_SHARE,
  };
}
