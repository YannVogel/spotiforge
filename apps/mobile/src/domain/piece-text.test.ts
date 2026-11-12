import { FORGE_LIMITS } from '@spotiforge/shared';

import { cleanPieceDescription, cleanPieceTitle } from './piece-text';
import { trackLinks } from './spotify-links';

describe('cleanPieceTitle', () => {
  it('retire les espaces en trop et coupe à 100 caractères', () => {
    expect(cleanPieceTitle('  Bord de   mer \n 2 h ')).toBe('Bord de mer 2 h');
    expect(cleanPieceTitle('x'.repeat(150))).toHaveLength(FORGE_LIMITS.title.maxLength);
  });

  it('refuse un titre vide', () => {
    expect(cleanPieceTitle('   ')).toBeNull();
  });
});

it('cleanPieceDescription garde une ligne de 300 caractères au plus, vide accepté', () => {
  expect(cleanPieceDescription(' Une\nphrase. ')).toBe('Une phrase.');
  expect(cleanPieceDescription('x'.repeat(400))).toHaveLength(FORGE_LIMITS.description.maxLength);
  expect(cleanPieceDescription('  ')).toBe('');
});

describe('trackLinks', () => {
  it('donne l’URI de l’app et la page web du titre', () => {
    expect(trackLinks('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toEqual({
      app: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
      web: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    });
  });

  it('refuse ce qui n’est pas une URI de titre', () => {
    expect(trackLinks('spotify:album:abc')).toBeNull();
    expect(trackLinks('https://open.spotify.com/track/abc')).toBeNull();
    expect(trackLinks('spotify:track:../../x')).toBeNull();
  });
});
