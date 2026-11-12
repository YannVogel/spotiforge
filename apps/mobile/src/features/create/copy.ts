import type { Shape } from '@spotiforge/shared';

// Textes de l'écran Création, dans le vocabulaire de docs/DESIGN.md et de la maquette.
// Le projet n'a pas de système de traduction : l'interface est en français.
export const CREATE_COPY = {
  hero: 'Qu’est-ce\nqu’on\nforge ?',
  pieces: 'Mes pièces',
  ore: 'Le minerai — ton moment',
  alloy: 'Alliage : mes écoutes',
  alloyUnavailable:
    'Spotify ne donne pas accès à tes écoutes pour l’instant : la forge se fera sans alliage.',
  length: {
    title: 'Longueur de la barre',
    minutes: (value: number) => `${value} MIN`,
    tracks: (value: number) => `${value} TITRES`,
    a11yMinutes: 'Durée en minutes',
    a11yTracks: 'Nombre de titres',
    a11yValueMinutes: (value: number) => `${value} minutes`,
    a11yValueTracks: (value: number) => `${value} titres`,
  },
  discovery: {
    title: 'Température de découverte',
    value: (value: number) => `${value} %`,
    a11y: 'Part de découverte en pourcentage',
    a11yValue: (value: number) => `${value} %`,
    cold: 'Froid : titres connus',
    hot: 'Brûlant : inédits',
  },
  decades: 'Époque',
  shape: 'Progression',
  shapes: { rise: 'Montée', fall: 'Descente', wave: 'Vague', free: 'Libre' } satisfies Record<
    Shape,
    string
  >,
  forge: 'Forger la playlist',
} as const;
