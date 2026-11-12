/** Un candidat du LLM retrouvé sur Spotify, prêt à entrer dans une pièce. */
export type ResolvedTrack = {
  spotifyUri: string;
  title: string;
  artist: string;
  year: number;
  durationMs: number;
  /** « Pourquoi ce titre ». */
  reason: string;
  /** Connu de la personne (bibliothèque, écoutes) ; sinon découverte. */
  known: boolean;
  /** Place souhaitée dans la progression, de 0 (début) à 1 (fin), reprise du candidat. */
  slot: number;
};

export type PieceTrack = ResolvedTrack & {
  /** Trempé : gardé tel quel, à sa position, à chaque reforge. */
  quenched: boolean;
};

/** Titre refusé (remplacé lors d'une reforge) : il ne revient plus dans la pièce. */
export type RejectedTrack = Pick<ResolvedTrack, 'spotifyUri' | 'artist' | 'title'>;
