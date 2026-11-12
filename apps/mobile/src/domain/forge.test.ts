import { FORGE_LIMITS } from '@spotiforge/shared';
import { makeCandidate, makeForgeRequest } from '@spotiforge/shared/testing';

import { complementRequest, needsComplement, targetTrackCount } from './forge';
import { makePieceTrack } from './test-fixtures';

describe('targetTrackCount', () => {
  it('compte exactement en titres, et 4 minutes par titre en minutes', () => {
    expect(targetTrackCount({ unit: 'tracks', value: 12 })).toBe(12);
    expect(targetTrackCount({ unit: 'minutes', value: 40 })).toBe(10);
    expect(targetTrackCount({ unit: 'minutes', value: 42 })).toBe(11);
  });
});

describe('needsComplement', () => {
  it('se déclenche au-delà d’un titre manquant sur cinq', () => {
    const ten = { unit: 'tracks', value: 10 } as const;
    expect(needsComplement(0, ten)).toBe(false);
    expect(needsComplement(2, ten)).toBe(false);
    expect(needsComplement(3, ten)).toBe(true);
    expect(needsComplement(1, { unit: 'tracks', value: 3 })).toBe(true);
  });
});

describe('complementRequest', () => {
  const piece = { tracks: [makePieceTrack(1), makePieceTrack(2)], rejected: [] };

  it('garde les titres retenus à leur place et écarte ceux-ci et les candidats écartés', () => {
    const request = makeForgeRequest({ avoid: [{ artist: 'Ancien', title: 'Refus' }] });

    const complement = complementRequest(request, piece, [
      makeCandidate({ artist: 'Inventé', title: 'Introuvable' }),
    ]);

    expect(complement.keep).toEqual([
      { position: 0, artist: 'Artiste 1', title: 'Titre 1' },
      { position: 1, artist: 'Artiste 2', title: 'Titre 2' },
    ]);
    expect(complement.avoid).toEqual([
      { artist: 'Ancien', title: 'Refus' },
      { artist: 'Artiste 1', title: 'Titre 1' },
      { artist: 'Artiste 2', title: 'Titre 2' },
      { artist: 'Inventé', title: 'Introuvable' },
    ]);
    expect(complement.prompt).toBe(request.prompt);
  });

  it('reste dans les bornes du contrat', () => {
    const discarded = Array.from({ length: 400 }, (_, i) =>
      makeCandidate({ artist: `A${i}`, title: `T${i}` }),
    );

    const complement = complementRequest(makeForgeRequest(), piece, discarded);

    expect(complement.avoid).toHaveLength(FORGE_LIMITS.avoid.max);
    expect(complement.avoid?.at(-1)).toEqual({ artist: 'A399', title: 'T399' });
  });
});
