// Textes de l'écran « Sur l'enclume », dans le vocabulaire de docs/DESIGN.md et de la maquette.
export const ANVIL_COPY = {
  back: 'Retour au feu',
  backA11y: 'Retour au feu : revenir au minerai et aux réglages',
  heading: 'Sur l’enclume',
  legendHot: 'À chaud',
  legendHotText: ' : sera reforgé.',
  legendQuenched: 'Trempé',
  legendQuenchedText: ' : gardé tel quel.',
  quenchedCount: (count: number) => `${count} ${count > 1 ? 'trempés' : 'trempé'}`,
  meta: (artist: string, year: number, known: boolean) =>
    `${artist} · ${year} · ${known ? 'connu' : 'découverte'}`,
  reforge: (hot: number) => `Reforger ${hot} ${hot > 1 ? 'titres' : 'titre'}`,
  allQuenched: 'Tout est trempé',
  reforging: 'Reforge en cours…',
  send: 'Envoyer sur Spotify',
} as const;
