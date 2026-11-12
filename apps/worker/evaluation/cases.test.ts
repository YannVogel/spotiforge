import { forgeRequestSchema, SHAPES } from '@spotiforge/shared';
import { describe, expect, it } from 'vitest';

import { EVAL_CASES } from './cases';

const requests = EVAL_CASES.map(({ request }) => forgeRequestSchema.parse(request));

describe('jeu d’essais', () => {
  it.each(EVAL_CASES.map(({ id, request }) => [id, request] as const))(
    '%s respecte le contrat de forge',
    (_id, request) => {
      expect(forgeRequestSchema.safeParse(request).success).toBe(true);
    },
  );

  it('compte une dizaine de demandes aux noms distincts', () => {
    const ids = EVAL_CASES.map(({ id }) => id);

    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('couvre les progressions, les époques, taste, la création et la reforge', () => {
    expect(new Set(requests.map(({ shape }) => shape))).toEqual(new Set(SHAPES));
    expect(requests.some(({ decades }) => decades.length === 0)).toBe(true);
    expect(requests.some(({ decades }) => decades.length > 1)).toBe(true);
    expect(requests.some(({ taste }) => taste)).toBe(true);
    expect(requests.some(({ taste }) => !taste)).toBe(true);
    expect(requests.some(({ keep, avoid }) => keep && avoid)).toBe(true);
    expect(requests.some(({ keep }) => !keep)).toBe(true);
    expect(requests.some(({ locale }) => locale !== 'fr')).toBe(true);
  });
});
