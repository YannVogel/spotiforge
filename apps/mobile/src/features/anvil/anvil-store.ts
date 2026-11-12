import { create } from 'zustand';

import type { PieceRecord } from '../../domain/history';
import * as rules from '../../domain/piece';

function withPiece(record: PieceRecord, piece: rules.Piece): PieceRecord {
  return { ...record, tracks: [...piece.tracks], rejected: [...piece.rejected] };
}

type AnvilStore = {
  /** La pièce sur l'enclume, ou `null` si rien n'a encore été forgé. */
  record: PieceRecord | null;
  open: (record: PieceRecord) => void;
  toggleQuench: (spotifyUri: string) => void;
  close: () => void;
};

/** La pièce en cours de travail, partagée par l'enclume et ses actions. Les règles vivent dans le domaine. */
export const useAnvilStore = create<AnvilStore>()((set) => ({
  record: null,
  open: (record) => set({ record }),
  toggleQuench: (spotifyUri) =>
    set(({ record }) =>
      record ? { record: withPiece(record, rules.toggleQuench(record, spotifyUri)) } : {},
    ),
  close: () => set({ record: null }),
}));
