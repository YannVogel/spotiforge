import { forgeRequestSchema, forgeResponseSchema } from '@spotiforge/shared';
import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';

// Vérifie que l'app consomme le contrat partagé et ses fabriques, sans copie de types.
test("l'app valide le contrat de forge partagé", () => {
  expect(forgeRequestSchema.parse(makeForgeRequest())).toEqual(makeForgeRequest());
  expect(forgeResponseSchema.safeParse(makeForgeResponse()).success).toBe(true);
});
