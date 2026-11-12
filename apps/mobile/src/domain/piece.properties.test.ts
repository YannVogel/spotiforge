import type { ForgeLength } from '@spotiforge/shared';

import { applyReforge, type Piece } from './piece';
import { makePieceTrack, makeResolvedTrack, seededRandom } from './test-fixtures';
import type { ResolvedTrack } from './track';

// Tests de propriétés : 300 pièces aléatoires, graine fixe pour rester reproductible.
const RUNS = 300;

type Scenario = { piece: Piece; candidates: ResolvedTrack[]; length: ForgeLength };

function scenario(random: () => number, abundant: boolean): Scenario {
  const int = (max: number) => Math.floor(random() * max);
  const size = 3 + int(12);
  const tracks = Array.from({ length: size }, (_, i) =>
    makePieceTrack(i + 1, { quenched: random() < 0.4, durationMs: 120_000 + int(300_000) }),
  );
  const rejected = Array.from({ length: int(6) }, (_, i) => {
    const { spotifyUri, artist, title } = makeResolvedTrack(100 + i);
    return { spotifyUri, artist, title };
  });
  const pool = abundant ? size * 3 : int(size);
  // Candidats neufs, plus des pièges : titres de la pièce, refusés, doublons.
  const candidates = [
    ...Array.from({ length: pool }, (_, i) =>
      makeResolvedTrack(1000 + i, { slot: random(), durationMs: 120_000 + int(300_000) }),
    ),
    ...tracks.filter(() => random() < 0.5),
    ...rejected.map((track) => makeResolvedTrack(Number(track.spotifyUri.slice(-3)))),
    ...Array.from({ length: int(4) }, () => makeResolvedTrack(1000 + int(Math.max(pool, 1)))),
  ];
  const length: ForgeLength =
    random() < 0.5 ? { unit: 'tracks', value: size } : { unit: 'minutes', value: 10 + int(60) };
  return { piece: { tracks, rejected }, candidates, length };
}

function forEachScenario(abundant: boolean, check: (input: Scenario) => void) {
  const random = seededRandom(abundant ? 42 : 7);
  for (let run = 0; run < RUNS; run++) check(scenario(random, abundant));
}

const quenchedPositions = (piece: Piece) =>
  piece.tracks.flatMap((track, position) => (track.quenched ? [[track.spotifyUri, position]] : []));

describe('propriétés de la reforge', () => {
  it('avec assez de candidats, chaque titre trempé garde sa position', () => {
    forEachScenario(true, ({ piece, candidates, length }) => {
      const reforged = applyReforge(piece, candidates, length).piece;

      expect(quenchedPositions(reforged)).toEqual(quenchedPositions(piece));
    });
  });

  it('sans assez de candidats, aucun titre trempé ne se perd ni ne change d’ordre', () => {
    forEachScenario(false, ({ piece, candidates, length }) => {
      const reforged = applyReforge(piece, candidates, length).piece;
      const order = (p: Piece) => quenchedPositions(p).map(([uri]) => uri);

      expect(order(reforged)).toEqual(order(piece));
    });
  });

  it('ne produit jamais de doublon', () => {
    for (const abundant of [true, false]) {
      forEachScenario(abundant, ({ piece, candidates, length }) => {
        const uris = applyReforge(piece, candidates, length).piece.tracks.map((t) => t.spotifyUri);

        expect(new Set(uris).size).toBe(uris.length);
      });
    }
  });

  it('ne réintroduit jamais un titre refusé, ancien ou tout juste remplacé', () => {
    for (const abundant of [true, false]) {
      forEachScenario(abundant, ({ piece, candidates, length }) => {
        const reforged = applyReforge(piece, candidates, length).piece;
        const rejected = new Set(reforged.rejected.map((track) => track.spotifyUri));
        const hot = piece.tracks.filter((track) => !track.quenched);

        expect(reforged.tracks.filter((track) => rejected.has(track.spotifyUri))).toEqual([]);
        expect(hot.every((track) => rejected.has(track.spotifyUri))).toBe(true);
        expect(piece.rejected.every((track) => rejected.has(track.spotifyUri))).toBe(true);
      });
    }
  });

  it('en titres, avec assez de candidats, atteint exactement la longueur demandée', () => {
    forEachScenario(true, ({ piece, candidates, length }) => {
      if (length.unit !== 'tracks') return;
      const { piece: reforged, missing } = applyReforge(piece, candidates, length);

      expect(reforged.tracks).toHaveLength(length.value);
      expect(missing).toBe(0);
    });
  });
});
