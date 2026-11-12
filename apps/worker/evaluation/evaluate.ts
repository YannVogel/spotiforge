import { type ForgeResponse, forgeRequestSchema } from '@spotiforge/shared';

import { type CatalogTrack, findBestMatch } from '../../mobile/src/domain/match';
import type { ForgeGenerator, GenerationResult } from '../src/forge/generate';
import { planForge } from '../src/forge/plan';
import type { EvalCase } from './cases';
import { type CandidateCheck, type CaseMetrics, measureCase } from './metrics';

export type CaseResult =
  | {
      id: string;
      ok: true;
      response: ForgeResponse;
      checks: CandidateCheck[];
      metrics: CaseMetrics;
    }
  | { id: string; ok: false; reason: Extract<GenerationResult, { ok: false }>['reason'] };

export type EvalDependencies = {
  /** La génération du Worker : même prompt, même sortie structurée, mêmes tentatives. */
  generate: ForgeGenerator;
  /** La recherche Spotify de l'app (`GET /search?type=track`, 10 résultats au plus). */
  searchTracks: (query: { artist: string; title: string }) => Promise<CatalogTrack[]>;
  onProgress: (message: string) => void;
};

async function runCase(evalCase: EvalCase, deps: EvalDependencies): Promise<CaseResult> {
  const request = forgeRequestSchema.parse(evalCase.request);
  const result = await deps.generate(request, planForge(request));
  if (!result.ok) return { id: evalCase.id, ok: false, reason: result.reason };

  // Une recherche à la fois : le quota Spotify est partagé par les apps du compte développeur.
  const checks: CandidateCheck[] = [];
  for (const candidate of result.response.candidates) {
    const results = await deps.searchTracks(candidate);
    checks.push({ candidate, match: findBestMatch(candidate, results) });
  }
  return {
    id: evalCase.id,
    ok: true,
    response: result.response,
    checks,
    metrics: measureCase(request, checks),
  };
}

/** Lance les demandes d'essai l'une après l'autre et mesure chaque forge. */
export async function runEvaluation(
  cases: readonly EvalCase[],
  deps: EvalDependencies,
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const [index, evalCase] of cases.entries()) {
    deps.onProgress(`[${index + 1}/${cases.length}] ${evalCase.id}`);
    results.push(await runCase(evalCase, deps));
  }
  return results;
}
