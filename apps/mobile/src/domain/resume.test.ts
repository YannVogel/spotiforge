import { latestUnsent } from './resume';
import { makePieceRecord } from './test-fixtures';

const summary = (id: string, updatedAt: string, sentAt: string | null = null, trackCount = 3) => ({
  ...makePieceRecord({ id, updatedAt, sentAt }),
  trackCount,
});

it('choisit la pièce non envoyée la plus récemment modifiée', () => {
  const pieces = [
    summary('a', '2026-11-10T10:00:00Z'),
    summary('b', '2026-11-12T10:00:00Z', '2026-11-12T10:00:00Z'),
    summary('c', '2026-11-11T10:00:00Z'),
  ];

  expect(latestUnsent(pieces)?.id).toBe('c');
});

it('ignore les pièces vides et renvoie null sans candidate', () => {
  expect(latestUnsent([summary('a', '2026-11-10T10:00:00Z', null, 0)])).toBeNull();
  expect(latestUnsent([])).toBeNull();
});
