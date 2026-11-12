import type { PieceSummary } from './history';

/** La pièce à proposer de reprendre : la plus récente qui n'a pas été envoyée. */
export function latestUnsent(pieces: readonly PieceSummary[]): PieceSummary | null {
  return (
    [...pieces]
      .filter((piece) => piece.sentAt === null && piece.trackCount > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}
