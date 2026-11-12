import {
  type Candidate,
  FORGE_LIMITS,
  type ForgeLength,
  type ForgeRequest,
  type ForgeResponse,
  type TrackRef,
} from '@spotiforge/shared';

import { MINUTES_PER_TRACK, type Piece } from './piece';

export type ForgeErrorKind =
  /** Jeton refusé même après rafraîchissement : il faut se reconnecter. */
  | 'unauthorized'
  /** Compte absent de la liste autorisée du Worker. */
  | 'forbidden'
  /** Trop de forges : la forge refroidit. */
  | 'rate_limited'
  /** Le LLM ou Spotify n'a pas pu répondre au Worker, ou réponse inexploitable. */
  | 'unavailable'
  /** Le Worker refuse la requête : bug de l'app. */
  | 'invalid_request'
  | 'network';

export class ForgeError extends Error {
  override name = 'ForgeError';

  constructor(
    readonly kind: ForgeErrorKind,
    /** Sur `rate_limited` : attente conseillée par le Worker, en secondes. */
    readonly retryAfterS?: number,
  ) {
    super(`Forge request failed: ${kind}`);
  }
}

/** La personne a annulé la forge. Ce n'est pas une panne : rien à afficher. */
export class ForgeCancelledError extends Error {
  override name = 'ForgeCancelledError';
}

/** Ce dont le domaine a besoin du Worker de forge. */
export interface ForgeGateway {
  forge(request: ForgeRequest, signal?: AbortSignal): Promise<ForgeResponse>;
}

/** Nombre de titres visés : exact en titres, estimé à 4 minutes par titre en minutes. */
export function targetTrackCount(length: ForgeLength): number {
  return length.unit === 'tracks' ? length.value : Math.ceil(length.value / MINUTES_PER_TRACK);
}

/** S'il manque plus d'un titre sur cinq, une forge complémentaire est lancée, une seule fois. */
export function needsComplement(missing: number, length: ForgeLength): boolean {
  return missing * 5 > targetTrackCount(length);
}

/**
 * Requête de la forge complémentaire : les titres déjà retenus sont transmis comme à garder, à leur
 * place (le Worker ne demande alors que de quoi remplir les places libres), et ni eux ni les
 * candidats écartés (introuvables, doublons) ne doivent revenir.
 */
export function complementRequest(
  request: ForgeRequest,
  piece: Piece,
  discarded: readonly Candidate[],
): ForgeRequest {
  const keep = piece.tracks.map((track, position) => ({
    position,
    artist: track.artist,
    title: track.title,
  }));
  const avoid: TrackRef[] = [
    ...(request.avoid ?? []),
    ...piece.tracks.map(({ artist, title }) => ({ artist, title })),
    ...discarded.map(({ artist, title }) => ({ artist, title })),
  ].slice(-FORGE_LIMITS.avoid.max);
  return { ...request, keep: keep.slice(0, FORGE_LIMITS.keep.max), avoid };
}
