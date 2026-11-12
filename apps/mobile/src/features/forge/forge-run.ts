import type { ForgeRequest } from '@spotiforge/shared';

import type { Draft } from '../../domain/draft';
import { markKnownTracks } from '../../domain/familiarity';
import {
  complementRequest,
  ForgeCancelledError,
  type ForgeGateway,
  needsComplement,
} from '../../domain/forge';
import type { PieceRecord } from '../../domain/history';
import { forgePiece } from '../../domain/piece';
import { type Discarded, resolveCandidates } from '../../domain/resolution';
import type { ResolutionCache } from '../../domain/resolution-cache';
import type { SpotifyGateway } from '../../domain/spotify';
import type { TasteCache } from '../../domain/taste';
import type { ResolvedTrack } from '../../domain/track';
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

/**
 * Du minerai à la pièce sur l'enclume : résumé des écoutes, appel au Worker, résolution sur
 * Spotify, assemblage, forge complémentaire (une seule fois) s'il manque plus d'un titre sur cinq,
 * puis marquage « connu » / « découverte ». Le brouillon n'est jamais modifié.
 */
export async function runForge(draft: Draft, deps: ForgeRunDependencies): Promise<PieceRecord> {
  const { signal, onProgress, now } = deps;

  onProgress?.({ stage: 'listening' });
  const taste = await loadTasteForForge({
    gateway: deps.spotify,
    cache: deps.tasteCache,
    ownerSpotifyId: deps.ownerSpotifyId,
    now,
  });
  throwIfCancelled(signal);

  const request = forgeRequestWithTaste(draft, taste);
  const resolve = async (forgeRequest: ForgeRequest, excludedUris: ReadonlySet<string>) => {
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
      { avoid: forgeRequest.avoid ?? [], excludedUris },
    );
    throwIfCancelled(signal);
    return { response, ...result };
  };

  const first = await resolve(request, new Set());
  let resolved: ResolvedTrack[] = first.resolved;
  let assembly = forgePiece(resolved, request.length);

  if (needsComplement(assembly.missing, request.length)) {
    const discarded = first.discarded.map((entry: Discarded) => entry.candidate);
    const second = await resolve(
      complementRequest(request, assembly.piece, discarded),
      new Set(resolved.map((track) => track.spotifyUri)),
    );
    resolved = [...resolved, ...second.resolved];
    assembly = forgePiece(resolved, request.length);
  }

  if (assembly.piece.tracks.length === 0) {
    throw new NoTracksFoundError('No forged candidate was found on Spotify');
  }

  onProgress?.({ stage: 'marking' });
  const tracks = await markKnownTracks(assembly.piece.tracks, {
    libraryContains: deps.spotify.libraryContains,
    taste: taste.status === 'ready' ? taste.taste : null,
  });
  throwIfCancelled(signal);

  const at = now().toISOString();
  return {
    id: deps.newId(),
    ownerSpotifyId: deps.ownerSpotifyId,
    title: first.response.title,
    description: first.response.description,
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
    tracks,
    rejected: [],
  };
}
