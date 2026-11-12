import { describe, expect, it } from 'vitest';

import { takeSlot, type WindowLimit } from './sliding-window';

const MINUTE = 60_000;
const LIMIT: WindowLimit = { max: 3, windowMs: 60 * MINUTE };
const START = 1_000_000_000;

/** Rejoue des passages successifs, horloge simulée, et renvoie les verdicts. */
function replay(times: number[], limit = LIMIT) {
  let timestamps: number[] = [];
  return times.map((now) => {
    const decision = takeSlot(timestamps, now, limit);
    timestamps = decision.timestamps;
    return decision.verdict;
  });
}

describe('takeSlot', () => {
  it('accepte jusqu’à la limite puis refuse, en disant quand une place se libère', () => {
    const verdicts = replay([START, START + MINUTE, START + 2 * MINUTE, START + 10 * MINUTE]);

    expect(verdicts).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: true },
      // Le premier passage sort de la fenêtre 50 minutes plus tard.
      { allowed: false, retryAfterSeconds: 50 * 60 },
    ]);
  });

  it('libère une place quand le plus ancien passage sort de la fenêtre', () => {
    const verdicts = replay([
      START,
      START + MINUTE,
      START + 2 * MINUTE,
      START + 60 * MINUTE - 1,
      START + 60 * MINUTE,
      START + 60 * MINUTE + 1,
    ]);

    expect(verdicts.map((verdict) => verdict.allowed)).toEqual([
      true,
      true,
      true,
      false,
      // Pile une heure après : le premier passage ne compte plus.
      true,
      // Le deuxième compte encore pour une minute.
      false,
    ]);
  });

  it('ne compte pas les refus', () => {
    const refusals = Array.from({ length: 20 }, (_, index) => START + 5 * MINUTE + index);
    const verdicts = replay([START, START, START, ...refusals, START + 60 * MINUTE]);

    expect(verdicts.at(-1)).toEqual({ allowed: true });
  });

  it('arrondit l’attente à la seconde supérieure', () => {
    const [, verdict] = replay([START, START + 60 * MINUTE - 1_500], {
      max: 1,
      windowMs: LIMIT.windowMs,
    });

    expect(verdict).toEqual({ allowed: false, retryAfterSeconds: 2 });
  });

  it('oublie les passages sortis de la fenêtre', () => {
    const decision = takeSlot([START - 2 * 60 * MINUTE, START - 30 * MINUTE], START, LIMIT);

    expect(decision.timestamps).toEqual([START - 30 * MINUTE, START]);
  });

  it('attend que plusieurs passages sortent quand la limite a baissé', () => {
    const timestamps = [START, START + MINUTE, START + 2 * MINUTE, START + 3 * MINUTE];

    const decision = takeSlot(timestamps, START + 4 * MINUTE, { max: 2, windowMs: LIMIT.windowMs });

    // Il faut repasser sous 2 : le troisième passage (START + 2 min) doit sortir.
    expect(decision.verdict).toEqual({ allowed: false, retryAfterSeconds: 58 * 60 });
  });
});
