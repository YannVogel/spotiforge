import { makeForgeRequest, makeKeptTrack } from '@spotiforge/shared/testing';
import { describe, expect, it } from 'vitest';

import { planForge } from './plan';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('planForge', () => {
  it('demande 1,5 fois le nombre de titres visés', () => {
    expect(planForge(makeForgeRequest({ length: { unit: 'tracks', value: 20 } }))).toEqual({
      candidateCount: 30,
      totalPositions: 20,
      freePositions: range(20),
    });
  });

  it('compte 4 minutes par titre pour une longueur en minutes', () => {
    expect(planForge(makeForgeRequest({ length: { unit: 'minutes', value: 40 } }))).toMatchObject({
      candidateCount: 15,
      totalPositions: 10,
    });
    expect(planForge(makeForgeRequest({ length: { unit: 'minutes', value: 42 } }))).toMatchObject({
      candidateCount: 17,
      totalPositions: 11,
    });
  });

  it('en reforge, ne demande que de quoi remplir les places libres', () => {
    const plan = planForge(
      makeForgeRequest({
        length: { unit: 'tracks', value: 10 },
        keep: [makeKeptTrack(0), makeKeptTrack(3)],
      }),
    );

    expect(plan).toEqual({
      candidateCount: 12,
      totalPositions: 10,
      freePositions: [1, 2, 4, 5, 6, 7, 8, 9],
    });
  });

  it('compte un titre trempé au-delà de la longueur visée', () => {
    const plan = planForge(
      makeForgeRequest({ length: { unit: 'tracks', value: 3 }, keep: [makeKeptTrack(5)] }),
    );

    expect(plan.totalPositions).toBe(6);
    expect(plan.freePositions).toEqual([0, 1, 2, 3, 4]);
  });

  it('demande au moins un candidat quand tout est trempé', () => {
    const plan = planForge(
      makeForgeRequest({
        length: { unit: 'tracks', value: 3 },
        keep: [makeKeptTrack(0), makeKeptTrack(1), makeKeptTrack(2)],
      }),
    );

    expect(plan).toEqual({ candidateCount: 2, totalPositions: 3, freePositions: [] });
  });

  it('ne dépasse jamais la limite du contrat', () => {
    const plan = planForge(makeForgeRequest({ keep: [makeKeptTrack(99)] }));

    expect(plan.candidateCount).toBe(100);
  });
});
