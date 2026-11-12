import type { TrackRef } from '@spotiforge/shared';

import type { CaseResult } from './evaluate';
import { type EvalSummary, MIN_FOUND_SHARE, type Ratio, share, summarize } from './metrics';

export type ReportContext = { model: string; promptVersion: string };

function percent(ratio: Ratio): string {
  return `${ratio.matching}/${ratio.total} (${Math.round(share(ratio) * 100)} %)`;
}

function tracks(refs: readonly (TrackRef & { year?: number })[]): string {
  return refs
    .map(({ artist, title, year }) => `${artist} — ${title}${year ? ` (${year})` : ''}`)
    .join(' ; ');
}

function caseSection(result: CaseResult): string[] {
  if (!result.ok) return [`## ${result.id}`, `Forge en échec : ${result.reason}`, ''];

  const { response, checks, metrics } = result;
  const notFound = checks.filter(({ match }) => !match).map(({ candidate }) => candidate);
  const lines = [
    `## ${result.id} : « ${response.title} »`,
    response.description,
    `Titres réels : ${percent(metrics.found)}`,
  ];
  if (metrics.candidateYears && metrics.spotifyYears) {
    lines.push(
      `Décennies : ${percent(metrics.candidateYears)} d'après le modèle, ` +
        `${percent(metrics.spotifyYears)} d'après Spotify`,
    );
  }
  lines.push(
    `Artistes : ${metrics.overusedArtists.length} au-delà de deux titres, ` +
      `${metrics.consecutiveRepeats} à la suite, ${metrics.duplicateTracks.length} titre(s) en double`,
    `Repris de avoid ou keep : ${metrics.avoidViolations.length}`,
  );
  if (notFound.length > 0) lines.push(`Introuvables : ${tracks(notFound)}`);
  if (metrics.overusedArtists.length > 0) {
    const overused = metrics.overusedArtists.map(({ artist, count }) => `${artist} (${count})`);
    lines.push(`Trop présents : ${overused.join(' ; ')}`);
  }
  if (metrics.duplicateTracks.length > 0) {
    lines.push(`En double : ${tracks(metrics.duplicateTracks)}`);
  }
  if (metrics.avoidViolations.length > 0) {
    lines.push(`Reproposés : ${tracks(metrics.avoidViolations)}`);
  }
  return [...lines, ''];
}

function summarySection(summary: EvalSummary, context: ReportContext): string[] {
  const verdict = summary.meetsFoundCriterion ? 'atteint' : 'non atteint';
  return [
    `# Bilan : prompt ${context.promptVersion}, modèle ${context.model}`,
    `Forges : ${summary.forged} réussie(s), ${summary.failed} en échec`,
    `Titres réels : ${percent(summary.found)}, critère ≥ ${MIN_FOUND_SHARE * 100} % ${verdict}`,
    `Années dans les décennies demandées (modèle) : ${percent(summary.candidateYears)}`,
    `Artistes au-delà de deux titres : ${summary.overusedArtists} ; à la suite : ${summary.consecutiveRepeats} ; titres en double : ${summary.duplicateTracks}`,
    `Titres de avoid ou keep reproposés : ${summary.avoidViolations}`,
  ];
}

/** Rapport lisible d'une évaluation : une section par demande d'essai, puis le bilan. */
export function formatReport(results: readonly CaseResult[], context: ReportContext): string {
  const forged = results.flatMap((result) => (result.ok ? [result.metrics] : []));
  const summary = summarize(forged, results.length - forged.length);
  return [...results.flatMap(caseSection), ...summarySection(summary, context)].join('\n') + '\n';
}
