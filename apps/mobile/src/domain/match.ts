import { artistNames, normalizeArtistName, parseTitle, UNWANTED_VARIANTS } from './normalize';

/** Un titre tel que renvoyé par la recherche du catalogue (vue du domaine). */
export type CatalogTrack = {
  spotifyUri: string;
  title: string;
  artists: readonly string[];
  /** Année de sortie de l'album qui porte cette version, si connue. */
  year?: number;
  durationMs: number;
};

/** Ce que l'on cherche : un candidat du LLM. */
export type MatchQuery = { artist: string; title: string; year: number };

/** En dessous, deux titres sont considérés comme différents. */
export const MIN_TITLE_SIMILARITY = 0.85;

const PENALTY = {
  unwantedVariant: 50,
  otherVariant: 3,
  perYearApart: 1,
  maxYearPenalty: 20,
};

export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Similarité de 0 à 1 entre deux chaînes déjà normalisées. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

function titleSimilarity(wanted: string[], found: string[]): number {
  return Math.max(0, ...wanted.flatMap((a) => found.map((b) => similarity(a, b))));
}

function sameArtist(query: MatchQuery, track: CatalogTrack): boolean {
  const wanted = new Set(artistNames(query.artist));
  const found = [
    ...track.artists.map(normalizeArtistName),
    normalizeArtistName(track.artists.join(' & ')),
  ];
  return found.some((name) => wanted.has(name));
}

/**
 * Choisit, parmi les résultats d'une recherche, la version qui correspond au candidat : même
 * artiste, titre assez proche, version studio d'origine de préférence (pénalité pour les live,
 * remix, reprises… non demandés), année la plus proche. Renvoie `null` si rien ne correspond
 * assez : mieux vaut écarter un candidat que garder un mauvais titre.
 */
export function findBestMatch(
  query: MatchQuery,
  results: readonly CatalogTrack[],
): CatalogTrack | null {
  const wanted = parseTitle(query.title);
  let best: { track: CatalogTrack; score: number } | null = null;

  for (const track of results) {
    if (!sameArtist(query, track)) continue;
    const found = parseTitle(track.title);
    const titleScore = titleSimilarity(wanted.forms, found.forms);
    if (titleScore < MIN_TITLE_SIMILARITY) continue;

    let score = titleScore * 100;
    for (const variant of found.variants) {
      if (wanted.variants.has(variant)) continue;
      score -= UNWANTED_VARIANTS.has(variant) ? PENALTY.unwantedVariant : PENALTY.otherVariant;
    }
    if (track.year !== undefined) {
      score -= Math.min(
        Math.abs(track.year - query.year) * PENALTY.perYearApart,
        PENALTY.maxYearPenalty,
      );
    }
    // À score égal, le premier résultat (le plus pertinent pour Spotify) l'emporte.
    if (!best || score > best.score) best = { track, score };
  }

  return best?.track ?? null;
}
