import type { ForgeRequest } from '@spotiforge/shared';

import { type Draft, draftFrom } from '../../domain/draft';
import { markKnownTracks } from '../../domain/familiarity';
import {
  complementRequest,
  ForgeCancelledError,
  type ForgeGateway,
  needsComplement,
} from '../../domain/forge';
import type { PieceRecord } from '../../domain/history';
import {
  applyReforge,
  type Assembly,
  forgePiece,
  hotTracks,
  type Piece,
  prepareReforge,
} from '../../domain/piece';
import { resolveCandidates } from '../../domain/resolution';
import type { ResolutionCache } from '../../domain/resolution-cache';
import type { SpotifyGateway } from '../../domain/spotify';
import type { TasteCache, TasteResult } from '../../domain/taste';
import type { PieceTrack, ResolvedTrack } from '../../domain/track';
import { forgeRequestWithTaste, loadTasteForForge } from '../taste/taste-service';

/** Étape en cours, pour l'état « forge en cours ». */
export type ForgeProgress =
  | { stage: 'listening' }
  | { stage: 'forging' }
  | { stage: 'resolving'; done: number; total: number }
  | { stage: 'marking' };

/** Aucun titre proposé n'existe sur Spotify : rien à poser sur l'enclume. */
export class NoTracksFoundError extends Error {
  override name = 'NoTracksFoundError';
}

export type ForgeRunDependencies = {
  forge: ForgeGateway;
  spotify: Pick<
    SpotifyGateway,
    'searchTracks' | 'getTopArtists' | 'getRecentlyPlayedArtists' | 'libraryContains'
  >;
  resolutionCache: ResolutionCache;
  tasteCache: TasteCache;
  ownerSpotifyId: string;
  now: () => Date;
  newId: () => string;
  onProgress?: (progress: ForgeProgress) => void;
  signal?: AbortSignal;
};

function throwIfCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new ForgeCancelledError('Forge cancelled');
}

async function loadTaste(deps: ForgeRunDependencies): Promise<TasteResult> {
  deps.onProgress?.({ stage: 'listening' });
  const taste = await loadTasteForForge({
    gateway: deps.spotify,
    cache: deps.tasteCache,
    ownerSpotifyId: deps.ownerSpotifyId,
    now: deps.now,
  });
  throwIfCancelled(deps.signal);
  return taste;
}

/**
 * Le cœur commun à la forge et à la reforge : appel au Worker, résolution sur Spotify, assemblage
 * par `assemble`, forge complémentaire (une seule fois) s'il manque plus d'un titre sur cinq, puis
 * marquage « connu » / « découverte » des seuls titres à chaud (les trempés sont déjà marqués).
 */
async function forgeTracks(
  request: ForgeRequest,
  assemble: (candidates: readonly ResolvedTrack[]) => Assembly,
  excludedUris: ReadonlySet<string>,
  taste: TasteResult,
  deps: ForgeRunDependencies,
): Promise<{ title: string; description: string; piece: Piece }> {
  const { signal, onProgress, now } = deps;
  const resolve = async (forgeRequest: ForgeRequest, excluded: ReadonlySet<string>) => {
    onProgress?.({ stage: 'forging' });
    const response = await deps.forge.forge(forgeRequest, signal);
    throwIfCancelled(signal);
    const result = await resolveCandidates(
      response.candidates,
      {
        search: deps.spotify.searchTracks,
        cache: deps.resolutionCache,
        now,
        onProgress: (done, total) => onProgress?.({ stage: 'resolving', done, total }),
      },
      { avoid: forgeRequest.avoid ?? [], excludedUris: excluded },
    );
    throwIfCancelled(signal);
    return { response, ...result };
  };

  const first = await resolve(request, excludedUris);
  let resolved: ResolvedTrack[] = first.resolved;
  let assembly = assemble(resolved);

  if (needsComplement(assembly.missing, request.length)) {
    const discarded = first.discarded.map((entry) => entry.candidate);
    const second = await resolve(
      complementRequest(request, assembly.piece, discarded),
      new Set([...excludedUris, ...resolved.map((track) => track.spotifyUri)]),
    );
    resolved = [...resolved, ...second.resolved];
    assembly = assemble(resolved);
  }

  // Aucun nouveau titre : rien à proposer. En reforge, la pièce d'origine reste intacte.
  if (hotTracks(assembly.piece).length === 0) {
    throw new NoTracksFoundError('No forged candidate was found on Spotify');
  }

  onProgress?.({ stage: 'marking' });
  const marked = await markKnownTracks(hotTracks(assembly.piece), {
    libraryContains: deps.spotify.libraryContains,
    taste: taste.status === 'ready' ? taste.taste : null,
  });
  throwIfCancelled(signal);
  const markedByUri = new Map(marked.map((track) => [track.spotifyUri, track]));
  const tracks: PieceTrack[] = assembly.piece.tracks.map(
    (track) => markedByUri.get(track.spotifyUri) ?? track,
  );

  return {
    title: first.response.title,
    description: first.response.description,
    piece: { tracks, rejected: assembly.piece.rejected },
  };
}

/**
 * Du minerai à la pièce sur l'enclume : résumé des écoutes, appel au Worker, résolution sur
 * Spotify, assemblage, forge complémentaire (une seule fois) s'il manque plus d'un titre sur cinq,
 * puis marquage « connu » / « découverte ». Le brouillon n'est jamais modifié.
 */
export async function runForge(draft: Draft, deps: ForgeRunDependencies): Promise<PieceRecord> {
  const taste = await loadTaste(deps);
  const request = forgeRequestWithTaste(draft, taste);
  const { title, description, piece } = await forgeTracks(
    request,
    (candidates) => forgePiece(candidates, request.length),
    new Set(),
    taste,
    deps,
  );

  const at = deps.now().toISOString();
  return {
    id: deps.newId(),
    ownerSpotifyId: deps.ownerSpotifyId,
    title,
    description,
    prompt: request.prompt,
    settings: {
      ...draft.settings,
      length: { ...draft.settings.length },
      decades: [...draft.settings.decades],
    },
    spotifyPlaylistId: null,
    createdAt: at,
    updatedAt: at,
    sentAt: null,
    tracks: [...piece.tracks],
    rejected: [...piece.rejected],
  };
}

/**
 * Reforge : remplace les titres à chaud, les titres trempés gardent leur place. Le Worker reçoit
 * les trempés (`keep`) et tout ce qu'il ne doit pas proposer (`avoid`) ; les titres remplacés
 * rejoignent les refusés de la pièce et ne reviennent plus. Titre et description ne changent pas
 * (ils ont pu être modifiés). La pièce d'origine n'est jamais modifiée : en cas d'échec, elle
 * reste telle quelle.
 */
export async function runReforge(
  record: PieceRecord,
  deps: ForgeRunDependencies,
): Promise<PieceRecord> {
  if (hotTracks(record).length === 0) return record;

  const taste = await loadTaste(deps);
  const request: ForgeRequest = {
    ...forgeRequestWithTaste(draftFrom(record), taste),
    ...prepareReforge(record),
  };
  const excludedUris = new Set([
    ...record.rejected.map((track) => track.spotifyUri),
    ...record.tracks.map((track) => track.spotifyUri),
  ]);
  const { piece } = await forgeTracks(
    request,
    (candidates) => applyReforge(record, candidates, record.settings.length),
    excludedUris,
    taste,
    deps,
  );

  return {
    ...record,
    tracks: [...piece.tracks],
    rejected: [...piece.rejected],
    updatedAt: deps.now().toISOString(),
  };
}
