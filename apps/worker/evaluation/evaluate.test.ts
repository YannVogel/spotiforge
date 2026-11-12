// L'orchestration de l'évaluation, avec Claude et Spotify simulés : aucun appel réseau.
import { makeCandidate, makeForgeResponse } from '@spotiforge/shared/testing';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogTrack } from '../../mobile/src/domain/match';
import type { ForgeGenerator } from '../src/forge/generate';
import type { EvalCase } from './cases';
import { runEvaluation } from './evaluate';
import { formatReport } from './report';

const cases: EvalCase[] = [
  {
    id: 'cas-a',
    request: {
      prompt: 'Un essai inventé.',
      length: { unit: 'tracks', value: 3 },
      discovery: 50,
      decades: ['80s'],
      shape: 'rise',
      avoid: [{ artist: 'Refusé', title: 'Non' }],
    },
  },
  {
    id: 'cas-b',
    request: {
      prompt: 'Un autre.',
      length: { unit: 'tracks', value: 3 },
      discovery: 0,
      shape: 'free',
    },
  },
];

const response = makeForgeResponse({
  title: 'Essai',
  candidates: [
    makeCandidate({ artist: 'Réel', title: 'Existe', year: 1984, slot: 0 }),
    makeCandidate({ artist: 'Inventé', title: 'Imaginaire', year: 1985, slot: 0.5 }),
    makeCandidate({ artist: 'Refusé', title: 'Non', year: 1999, slot: 1 }),
  ],
});

/** Spotify simulé : seuls « Réel — Existe » et « Refusé — Non » sont au catalogue. */
async function searchTracks({ artist, title }: { artist: string; title: string }) {
  const catalog: CatalogTrack[] = [
    {
      spotifyUri: 'spotify:track:1',
      title: 'Existe',
      artists: ['Réel'],
      year: 1984,
      durationMs: 1,
    },
    { spotifyUri: 'spotify:track:2', title: 'Non', artists: ['Refusé'], year: 1999, durationMs: 1 },
  ];
  return catalog.filter((track) => track.title === title && track.artists.includes(artist));
}

describe('runEvaluation', () => {
  it('forge chaque demande, résout chaque candidat et rend un rapport', async () => {
    const generate = vi.fn<ForgeGenerator>(async (request) =>
      request.prompt === 'Un autre.'
        ? { ok: false, reason: 'invalid_output' }
        : { ok: true, response },
    );
    const search = vi.fn(searchTracks);
    const progress: string[] = [];

    const results = await runEvaluation(cases, {
      generate,
      searchTracks: search,
      onProgress: (message) => progress.push(message),
    });

    expect(progress).toEqual(['[1/2] cas-a', '[2/2] cas-b']);
    // La requête passe par le contrat (valeurs par défaut appliquées) et par le plan du Worker.
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ locale: 'fr', decades: ['80s'] });
    expect(generate.mock.calls[0]?.[1]).toMatchObject({ candidateCount: 5, totalPositions: 3 });
    expect(search).toHaveBeenCalledTimes(3);

    const [first, second] = results;
    expect(second).toEqual({ id: 'cas-b', ok: false, reason: 'invalid_output' });
    expect(first?.ok && first.metrics).toMatchObject({
      found: { matching: 2, total: 3 },
      candidateYears: { matching: 2, total: 3 },
      avoidViolations: [{ artist: 'Refusé', title: 'Non' }],
    });

    const report = formatReport(results, { model: 'fake-model', promptVersion: 'abcd1234' });
    expect(report).toContain('## cas-a : « Essai »');
    expect(report).toContain('Titres réels : 2/3 (67 %)');
    expect(report).toContain('Introuvables : Inventé — Imaginaire (1985)');
    expect(report).toContain('Reproposés : Refusé — Non');
    expect(report).toContain('Forge en échec : invalid_output');
    expect(report).toContain('# Bilan : prompt abcd1234, modèle fake-model');
    expect(report).toContain('Titres réels : 2/3 (67 %), critère ≥ 80 % non atteint');
  });
});
