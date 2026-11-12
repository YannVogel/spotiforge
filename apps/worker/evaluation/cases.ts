import type { ForgeRequestInput } from '@spotiforge/shared';

/** Une demande d'essai de la forge, identifiée par un nom court (filtre de la commande). */
export type EvalCase = { id: string; request: ForgeRequestInput };

/**
 * Jeu d'essais du prompt système : des demandes inventées, variées en genres, époques,
 * progressions, avec et sans `taste`, en création et en reforge. Les profils `taste` sont
 * inventés à partir d'artistes connus : ce ne sont les écoutes de personne. Les titres de `keep`
 * et `avoid` sont réels, comme ceux qu'une vraie pièce contiendrait.
 */
export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'apero-funk-70s',
    request: {
      prompt: 'Apéro entre amis sur un balcon, du funk et de la disco qui donnent envie de bouger.',
      length: { unit: 'tracks', value: 15 },
      discovery: 40,
      decades: ['70s'],
      shape: 'rise',
    },
  },
  {
    id: 'velo-indie',
    request: {
      prompt: 'Trajet à vélo le matin, des guitares lumineuses pour se réveiller.',
      length: { unit: 'minutes', value: 30 },
      discovery: 70,
      decades: ['00s', '10s'],
      shape: 'free',
      taste: {
        topArtists: ['Arctic Monkeys', 'The Strokes', 'Phoenix', 'Two Door Cinema Club'],
        recentArtists: ['Wet Leg', 'Fontaines D.C.'],
        genres: ['indie rock', 'garage rock'],
      },
    },
  },
  {
    id: 'jazz-dimanche',
    request: {
      prompt: 'Dimanche matin, café et jazz modal tranquille, qui s’anime un peu puis se pose.',
      length: { unit: 'minutes', value: 40 },
      discovery: 80,
      decades: ['60s'],
      shape: 'wave',
    },
  },
  {
    id: 'fractionne-electro',
    request: {
      prompt: 'Fractionné de course à pied, de l’électro qui cogne de plus en plus fort.',
      length: { unit: 'minutes', value: 45 },
      discovery: 50,
      decades: ['10s', '20s'],
      shape: 'rise',
    },
  },
  {
    id: 'rap-fr-90s',
    request: {
      prompt: 'Rap français des années 90, boom bap et textes qui comptent.',
      length: { unit: 'tracks', value: 20 },
      discovery: 30,
      decades: ['90s'],
      shape: 'free',
    },
  },
  {
    id: 'road-trip-en',
    request: {
      prompt: 'Desert road trip at dusk: americana and slow-burning rock.',
      length: { unit: 'minutes', value: 60 },
      discovery: 50,
      shape: 'wave',
      locale: 'en',
    },
  },
  {
    id: 'concentration-neo-classique',
    request: {
      prompt:
        'Concentration pour travailler longtemps : néo-classique et musique de film, sans paroles.',
      length: { unit: 'minutes', value: 90 },
      discovery: 90,
      decades: ['10s', '20s'],
      shape: 'free',
    },
  },
  {
    id: 'diner-bossa',
    request: {
      prompt: 'Un dîner qui s’étire : bossa nova et MPB, et l’on finit tout en douceur.',
      length: { unit: 'tracks', value: 12 },
      discovery: 100,
      decades: ['60s', '70s'],
      shape: 'fall',
      taste: {
        topArtists: ['Norah Jones', 'Melody Gardot', 'Madeleine Peyroux'],
        recentArtists: ['Gregory Porter'],
        genres: ['vocal jazz'],
      },
    },
  },
  {
    id: 'reforge-funk',
    request: {
      prompt: 'Soirée funk qui monte jusqu’au dancefloor.',
      length: { unit: 'tracks', value: 10 },
      discovery: 40,
      decades: ['70s', '80s'],
      shape: 'rise',
      keep: [
        { position: 0, artist: 'Kool & The Gang', title: 'Jungle Boogie' },
        { position: 3, artist: 'Chic', title: 'Le Freak' },
        { position: 7, artist: 'Earth, Wind & Fire', title: 'September' },
      ],
      avoid: [
        { artist: 'Stevie Wonder', title: 'Superstition' },
        { artist: 'James Brown', title: 'Get Up (I Feel Like Being a) Sex Machine' },
        { artist: 'Parliament', title: 'Give Up the Funk (Tear the Roof off the Sucker)' },
        { artist: 'Rick James', title: 'Super Freak' },
      ],
    },
  },
  {
    id: 'reforge-french-touch',
    request: {
      prompt: 'Soirée d’été entre amis, french touch et pop solaire.',
      length: { unit: 'tracks', value: 8 },
      discovery: 0,
      shape: 'wave',
      taste: {
        topArtists: ['Daft Punk', 'Air', 'Phoenix', 'Justice', 'Sébastien Tellier'],
        recentArtists: ['Polo & Pan', 'L’Impératrice'],
        genres: ['french touch', 'electro', 'indie pop'],
      },
      keep: [
        { position: 0, artist: 'Phoenix', title: '1901' },
        { position: 4, artist: 'Daft Punk', title: 'Digital Love' },
      ],
      avoid: [
        { artist: 'Daft Punk', title: 'One More Time' },
        { artist: 'Air', title: 'Sexy Boy' },
        { artist: 'Justice', title: 'D.A.N.C.E.' },
      ],
    },
  },
];
