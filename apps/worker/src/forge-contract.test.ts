import { forgeRequestSchema, forgeResponseSchema } from '@spotiforge/shared';
import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';
import { expect, it } from 'vitest';

// Vérifie que le Worker consomme le contrat partagé et ses fabriques, sans copie de types.
it('le Worker valide le contrat de forge partagé', () => {
  expect(forgeRequestSchema.parse(makeForgeRequest())).toEqual(makeForgeRequest());
  expect(forgeResponseSchema.safeParse(makeForgeResponse()).success).toBe(true);
});
