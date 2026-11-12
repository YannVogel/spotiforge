import { FORGE_LIMITS, type ForgeLength } from '@spotiforge/shared';

import {
  applyReforge,
  forgePiece,
  hotTracks,
  type Piece,
  prepareReforge,
  quench,
  quenchedCount,
  toggleQuench,
  unquench,
} from './piece';
import { makePieceTrack, makeResolvedTrack } from './test-fixtures';

const tracks = (count: number): ForgeLength => ({ unit: 'tracks', value: count });
const minutes = (value: number): ForgeLength => ({ unit: 'minutes', value });
const uris = (piece: Piece) => piece.tracks.map((track) => track.spotifyUri);
const n = (uri: string) => Number(uri.replace('spotify:track:fake', ''));

/** Candidats `from`..`to` (inclus), `slot` croissant dans l'ordre donné. */
function candidates(from: number, to: number) {
  const list = [];
  for (let i = from; i <= to; i++) list.push(makeResolvedTrack(i, { slot: (i - from) / 100 }));
  return list;
}

describe('forgePiece', () => {
  it('range les candidats par slot et coupe au nombre de titres demandé', () => {
    const shuffled = [
      makeResolvedTrack(1, { slot: 0.9 }),
      makeResolvedTrack(2, { slot: 0.1 }),
      makeResolvedTrack(3, { slot: 0.5 }),
      makeResolvedTrack(4, { slot: 0.7 }),
    ];

    const { piece, missing } = forgePiece(shuffled, tracks(3));

    expect(uris(piece).map(n)).toEqual([2, 3, 4]);
    expect(piece.tracks.every((track) => !track.quenched)).toBe(true);
    expect(piece.rejected).toEqual([]);
    expect(missing).toBe(0);
  });

  it('écarte les doublons', () => {
    const { piece } = forgePiece(
      [makeResolvedTrack(1), makeResolvedTrack(1, { slot: 0.5 }), makeResolvedTrack(2)],
      tracks(3),
    );

    expect(uris(piece).map(n)).toEqual([1, 2]);
  });

  it('signale les titres manquants quand les candidats ne suffisent pas', () => {
    const { piece, missing } = forgePiece(candidates(1, 3), tracks(5));

    expect(piece.tracks).toHaveLength(3);
    expect(missing).toBe(2);
  });

  it('ne produit rien sans candidat', () => {
    expect(forgePiece([], tracks(4))).toEqual({ piece: { tracks: [], rejected: [] }, missing: 4 });
  });

  describe('en minutes', () => {
    it('ajoute des titres jusqu’à la durée visée', () => {
      // 10 titres de 4 min, 40 min visées.
      const { piece, missing } = forgePiece(candidates(1, 20), minutes(40));

      expect(piece.tracks).toHaveLength(10);
      expect(missing).toBe(0);
    });

    it('garde la coupe la plus proche de la durée visée', () => {
      const list = [
        makeResolvedTrack(1, { slot: 0.1, durationMs: 6 * 60_000 }),
        makeResolvedTrack(2, { slot: 0.2, durationMs: 3 * 60_000 }),
        makeResolvedTrack(3, { slot: 0.3, durationMs: 9 * 60_000 }),
      ];

      // 10 min visées : 6 + 3 = 9 (1 min de moins) vaut mieux que 18 (8 de plus).
      expect(uris(forgePiece(list, minutes(10)).piece).map(n)).toEqual([1, 2]);
      // 16 min visées : 18 (2 de plus) vaut mieux que 9 (7 de moins).
      expect(uris(forgePiece(list, minutes(16)).piece).map(n)).toEqual([1, 2, 3]);
    });

    it('estime les titres manquants à 4 minutes par titre', () => {
      // 2 titres de 4 min pour 30 min visées : il manque 22 min, soit 6 titres.
      expect(forgePiece(candidates(1, 2), minutes(30)).missing).toBe(6);
    });
  });
});

describe('quench / unquench', () => {
  const piece: Piece = { tracks: [makePieceTrack(1), makePieceTrack(2)], rejected: [] };

  it('trempe puis remet au feu un seul titre, sans modifier la pièce d’origine', () => {
    const quenched = quench(piece, 'spotify:track:fake2');

    expect(quenched.tracks.map((track) => track.quenched)).toEqual([false, true]);
    expect(piece.tracks[1]?.quenched).toBe(false);
    expect(unquench(quenched, 'spotify:track:fake2').tracks[1]?.quenched).toBe(false);
  });

  it('ignore un titre absent de la pièce', () => {
    expect(quench(piece, 'spotify:track:absent')).toEqual(piece);
  });

  it('liste les titres à chaud', () => {
    expect(hotTracks(quench(piece, 'spotify:track:fake1')).map((t) => t.spotifyUri)).toEqual([
      'spotify:track:fake2',
    ]);
  });
});

describe('prepareReforge', () => {
  it('transmet les titres trempés avec leur position, et tout ce qu’il faut éviter', () => {
    const piece: Piece = {
      tracks: [makePieceTrack(1), makePieceTrack(2, { quenched: true }), makePieceTrack(3)],
      rejected: [{ spotifyUri: 'spotify:track:fake9', artist: 'Artiste 9', title: 'Titre 9' }],
    };

    const { keep, avoid } = prepareReforge(piece);

    expect(keep).toEqual([{ position: 1, artist: 'Artiste 2', title: 'Titre 2' }]);
    expect(avoid).toEqual([
      { artist: 'Artiste 9', title: 'Titre 9' },
      { artist: 'Artiste 1', title: 'Titre 1' },
      { artist: 'Artiste 3', title: 'Titre 3' },
      { artist: 'Artiste 2', title: 'Titre 2' },
    ]);
  });

  it('oublie les refus les plus anciens au-delà de la limite du contrat', () => {
    const rejected = Array.from({ length: FORGE_LIMITS.avoid.max + 5 }, (_, i) => ({
      spotifyUri: `spotify:track:old${i}`,
      artist: `Ancien ${i}`,
      title: `Refus ${i}`,
    }));

    const { avoid } = prepareReforge({ tracks: [makePieceTrack(1)], rejected });

    expect(avoid).toHaveLength(FORGE_LIMITS.avoid.max);
    expect(avoid[0]).toEqual({ artist: 'Ancien 6', title: 'Refus 6' });
    expect(avoid.at(-1)).toEqual({ artist: 'Artiste 1', title: 'Titre 1' });
  });
});

describe('applyReforge', () => {
  const piece: Piece = {
    tracks: [
      makePieceTrack(1),
      makePieceTrack(2, { quenched: true }),
      makePieceTrack(3),
      makePieceTrack(4, { quenched: true }),
    ],
    rejected: [],
  };

  it('garde les titres trempés à leur position et remplit les places libres par slot', () => {
    const { piece: reforged, missing } = applyReforge(piece, candidates(10, 20), tracks(4));

    expect(uris(reforged).map(n)).toEqual([10, 2, 11, 4]);
    expect(reforged.tracks.map((track) => track.quenched)).toEqual([false, true, false, true]);
    expect(missing).toBe(0);
  });

  it('refuse les titres remplacés et ne les reprend jamais', () => {
    const { piece: reforged } = applyReforge(
      piece,
      [makeResolvedTrack(1), makeResolvedTrack(3), ...candidates(10, 20)],
      tracks(4),
    );

    expect(reforged.rejected.map((track) => n(track.spotifyUri))).toEqual([1, 3]);
    expect(uris(reforged)).not.toContain('spotify:track:fake1');
    expect(uris(reforged)).not.toContain('spotify:track:fake3');
  });

  it('ne reprend pas un titre trempé parmi les candidats', () => {
    const { piece: reforged } = applyReforge(
      piece,
      [makeResolvedTrack(2), ...candidates(10, 20)],
      tracks(4),
    );

    expect(uris(reforged).filter((uri) => uri === 'spotify:track:fake2')).toHaveLength(1);
  });

  it('cumule les refus de reforge en reforge', () => {
    const first = applyReforge(piece, candidates(10, 20), tracks(4)).piece;
    const second = applyReforge(first, [...candidates(1, 3), ...candidates(10, 30)], tracks(4));

    expect(second.piece.rejected.map((track) => n(track.spotifyUri))).toEqual([1, 3, 10, 11]);
    expect(uris(second.piece).map(n)).toEqual([12, 2, 13, 4]);
  });

  it('ne touche à rien quand tout est trempé', () => {
    const allQuenched: Piece = {
      tracks: [makePieceTrack(1, { quenched: true }), makePieceTrack(2, { quenched: true })],
      rejected: [],
    };

    const { piece: reforged, missing } = applyReforge(allQuenched, candidates(10, 20), tracks(2));

    expect(reforged).toEqual(allQuenched);
    expect(missing).toBe(0);
  });

  it('remplace tout quand rien n’est trempé', () => {
    const cold: Piece = { tracks: [makePieceTrack(1), makePieceTrack(2)], rejected: [] };

    const { piece: reforged } = applyReforge(cold, candidates(10, 20), tracks(2));

    expect(uris(reforged).map(n)).toEqual([10, 11]);
    expect(reforged.rejected.map((track) => n(track.spotifyUri))).toEqual([1, 2]);
  });

  it('sans assez de candidats, garde tous les titres trempés dans l’ordre et compte les manques', () => {
    const { piece: reforged, missing } = applyReforge(piece, candidates(10, 10), tracks(4));

    expect(uris(reforged).map(n)).toEqual([10, 2, 4]);
    expect(missing).toBe(1);
  });

  it('garde un titre trempé placé au-delà de la nouvelle longueur', () => {
    const { piece: reforged } = applyReforge(piece, candidates(10, 20), tracks(2));

    expect(uris(reforged).map(n)).toEqual([10, 2, 11, 4]);
  });

  it('en minutes, garde les trempés et complète jusqu’à la durée visée', () => {
    const { piece: reforged } = applyReforge(piece, candidates(10, 20), minutes(24));

    // 4 min par titre : 6 titres pour 24 min.
    expect(uris(reforged).map(n)).toEqual([10, 2, 11, 4, 12, 13]);
  });
});

describe('toggleQuench et quenchedCount', () => {
  const piece: Piece = {
    tracks: [makePieceTrack(1), makePieceTrack(2, { quenched: true })],
    rejected: [],
  };

  it('trempe un titre à chaud et remet au feu un titre trempé', () => {
    const toggled = toggleQuench(toggleQuench(piece, 'spotify:track:fake1'), 'spotify:track:fake2');

    expect(toggled.tracks.map((track) => track.quenched)).toEqual([true, false]);
    expect(quenchedCount(piece)).toBe(1);
    expect(quenchedCount(toggled)).toBe(1);
  });

  it('ignore un titre absent de la pièce', () => {
    expect(toggleQuench(piece, 'spotify:track:absent')).toBe(piece);
  });
});
