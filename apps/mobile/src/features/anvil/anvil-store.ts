import { create } from 'zustand';

import type { PieceRecord } from '../../domain/history';
import * as rules from '../../domain/piece';
import { cleanPieceDescription, cleanPieceTitle } from '../../domain/piece-text';
import type { ForgeFailure } from '../forge/failure';

export type ReforgeState =
  { status: 'idle' } | { status: 'reforging' } | { status: 'failed'; failure: ForgeFailure };

function withPiece(record: PieceRecord, piece: rules.Piece): PieceRecord {
  return { ...record, tracks: [...piece.tracks], rejected: [...piece.rejected] };
}

type AnvilStore = {
  /** La pièce sur l'enclume, ou `null` si rien n'a encore été forgé. */
  record: PieceRecord | null;
  reforge: ReforgeState;
  open: (record: PieceRecord) => void;
  toggleQuench: (spotifyUri: string) => void;
  /** Titre et description modifiés à la main ; un titre vide garde l'ancien. */
  setDetails: (title: string, description: string) => void;
  close: () => void;
};

/** La pièce en cours de travail, partagée par l'enclume et ses actions. Les règles vivent dans le domaine. */
export const useAnvilStore = create<AnvilStore>()((set) => ({
  record: null,
  reforge: { status: 'idle' },
  open: (record) => set({ record, reforge: { status: 'idle' } }),
  // Pendant une reforge, la trempe est figée : la demande est déjà partie avec ces titres.
  toggleQuench: (spotifyUri) =>
    set(({ record, reforge }) =>
      record && reforge.status !== 'reforging'
        ? { record: withPiece(record, rules.toggleQuench(record, spotifyUri)) }
        : {},
    ),
  setDetails: (title, description) =>
    set(({ record }) =>
      record
        ? {
            record: {
              ...record,
              title: cleanPieceTitle(title) ?? record.title,
              description: cleanPieceDescription(description),
            },
          }
        : {},
    ),
  close: () => set({ record: null, reforge: { status: 'idle' } }),
}));
