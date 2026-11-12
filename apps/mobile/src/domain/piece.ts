import { FORGE_LIMITS, type ForgeLength, type KeptTrack, type TrackRef } from '@spotiforge/shared';

import type { PieceTrack, RejectedTrack, ResolvedTrack } from './track';

/** Les titres sur l'enclume, dans l'ordre, et ceux qui ont déjà été refusés. */
export type Piece = {
  tracks: readonly PieceTrack[];
  rejected: readonly RejectedTrack[];
};

export type Assembly = {
  piece: Piece;
  /**
   * Titres qui manquent pour atteindre la longueur demandée. En minutes, estimation à raison de
   * `MINUTES_PER_TRACK` minutes par titre (docs/GENERATION.md).
   */
  missing: number;
};

export const MINUTES_PER_TRACK = 4;
const MS_PER_MINUTE = 60_000;

type PlacedTrack = { position: number; track: PieceTrack };

type AssemblyInput = {
  quenched: readonly PlacedTrack[];
  candidates: readonly ResolvedTrack[];
  length: ForgeLength;
  excludedUris: ReadonlySet<string>;
};

/**
 * Assemble les titres d'une pièce : les titres trempés à leur position, les places libres
 * remplies dans l'ordre par les candidats triés par `slot`, puis coupe à la longueur demandée.
 * Un titre trempé n'est jamais retiré. S'il manque des candidats avant un titre trempé, la place
 * reste vide et les titres suivants remontent : c'est le seul cas où une position change.
 */
function assembleTracks({ quenched, candidates, length, excludedUris }: AssemblyInput) {
  const quenchedAt = new Map(quenched.map(({ position, track }) => [position, track]));
  const lastQuenchedPosition = Math.max(-1, ...quenchedAt.keys());
  const taken = new Set([...excludedUris, ...quenched.map(({ track }) => track.spotifyUri)]);
  const pool = uniqueByUri(candidates.filter((track) => !taken.has(track.spotifyUri))).sort(
    (a, b) => a.slot - b.slot,
  );

  const targetMs = length.value * MS_PER_MINUTE;
  const tracks: PieceTrack[] = [];
  let durationMs = 0;
  const isLongEnough = (position: number) =>
    length.unit === 'tracks' ? position >= length.value : durationMs >= targetMs;

  for (let position = 0; position <= lastQuenchedPosition || !isLongEnough(position); position++) {
    const kept = quenchedAt.get(position);
    const next = kept ?? pool.shift();
    if (!next) {
      if (position > lastQuenchedPosition) break;
      continue;
    }
    tracks.push(kept ?? { ...next, quenched: false });
    durationMs += next.durationMs;
  }

  if (length.unit === 'minutes') {
    durationMs = trimClosestToTarget(tracks, durationMs, targetMs);
  }

  return { tracks, missing: countMissing(length, tracks.length, durationMs) };
}

/** En minutes, retire le dernier titre libre s'il éloigne la pièce de la durée visée. */
function trimClosestToTarget(tracks: PieceTrack[], durationMs: number, targetMs: number): number {
  const last = tracks.at(-1);
  if (!last || last.quenched || durationMs <= targetMs) return durationMs;
  const withoutLast = durationMs - last.durationMs;
  if (targetMs - withoutLast >= durationMs - targetMs) return durationMs;
  tracks.pop();
  return withoutLast;
}

function countMissing(length: ForgeLength, trackCount: number, durationMs: number): number {
  if (length.unit === 'tracks') return Math.max(0, length.value - trackCount);
  const missingMs = length.value * MS_PER_MINUTE - durationMs;
  return missingMs > 0 ? Math.ceil(missingMs / (MINUTES_PER_TRACK * MS_PER_MINUTE)) : 0;
}

function uniqueByUri<T extends { spotifyUri: string }>(tracks: readonly T[]): T[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.spotifyUri)) return false;
    seen.add(track.spotifyUri);
    return true;
  });
}

function placedQuenched(piece: Piece): PlacedTrack[] {
  return piece.tracks.flatMap((track, position) => (track.quenched ? [{ position, track }] : []));
}

/** Première forge : rien n'est trempé, rien n'est refusé. */
export function forgePiece(candidates: readonly ResolvedTrack[], length: ForgeLength): Assembly {
  const { tracks, missing } = assembleTracks({
    quenched: [],
    candidates,
    length,
    excludedUris: new Set(),
  });
  return { piece: { tracks, rejected: [] }, missing };
}

function setQuenched(piece: Piece, spotifyUri: string, quenched: boolean): Piece {
  return {
    ...piece,
    tracks: piece.tracks.map((track) =>
      track.spotifyUri === spotifyUri ? { ...track, quenched } : track,
    ),
  };
}

/** Tremper un titre : il est gardé tel quel, à sa place. */
export function quench(piece: Piece, spotifyUri: string): Piece {
  return setQuenched(piece, spotifyUri, true);
}

/** Remettre un titre au feu : il sera remplacé à la prochaine reforge. */
export function unquench(piece: Piece, spotifyUri: string): Piece {
  return setQuenched(piece, spotifyUri, false);
}

/** Titres à chaud : ceux qu'une reforge remplacera. */
export function hotTracks(piece: Piece): PieceTrack[] {
  return piece.tracks.filter((track) => !track.quenched);
}

export function quenchedCount(piece: Piece): number {
  return piece.tracks.length - hotTracks(piece).length;
}

/** Bascule un titre : trempé s'il était à chaud, remis au feu s'il était trempé. */
export function toggleQuench(piece: Piece, spotifyUri: string): Piece {
  const track = piece.tracks.find((t) => t.spotifyUri === spotifyUri);
  if (!track) return piece;
  return track.quenched ? unquench(piece, spotifyUri) : quench(piece, spotifyUri);
}

/** Refusés après la reforge : les anciens, plus les titres à chaud qui vont être remplacés. */
function rejectHotTracks(piece: Piece): RejectedTrack[] {
  const replaced = hotTracks(piece).map(({ spotifyUri, artist, title }) => ({
    spotifyUri,
    artist,
    title,
  }));
  return uniqueByUri([...piece.rejected, ...replaced]);
}

/**
 * Ce que la demande de reforge transmet au Worker : les titres trempés avec leur position
 * (`keep`), et tout ce qu'il ne doit pas proposer (`avoid`) : refusés et titres de la pièce.
 * Au-delà de la limite du contrat, les plus anciens refus sont oubliés en premier.
 */
export function prepareReforge(piece: Piece): { keep: KeptTrack[]; avoid: TrackRef[] } {
  const keep = placedQuenched(piece).map(({ position, track }) => ({
    position,
    artist: track.artist,
    title: track.title,
  }));
  const avoid = uniqueByUri([...rejectHotTracks(piece), ...piece.tracks])
    .map(({ artist, title }) => ({ artist, title }))
    .slice(-FORGE_LIMITS.avoid.max);
  return { keep, avoid };
}

/**
 * Applique une reforge : les titres à chaud passent dans les refusés, les titres trempés restent
 * à leur position, les candidats remplissent les places libres. Aucun refusé ne revient.
 */
export function applyReforge(
  piece: Piece,
  candidates: readonly ResolvedTrack[],
  length: ForgeLength,
): Assembly {
  const rejected = rejectHotTracks(piece);
  const { tracks, missing } = assembleTracks({
    quenched: placedQuenched(piece),
    candidates,
    length,
    excludedUris: new Set(rejected.map((track) => track.spotifyUri)),
  });
  return { piece: { tracks, rejected }, missing };
}
