import type { ForgeSettings } from '@spotiforge/shared';

import type { PieceTrack, RejectedTrack } from './track';

/** Une pièce telle qu'elle est gardée sur le téléphone (« Mes pièces »). */
export type PieceRecord = {
  id: string;
  /** Compte Spotify qui l'a forgée : l'historique est cloisonné par compte. */
  ownerSpotifyId: string;
  title: string;
  description: string;
  prompt: string;
  settings: ForgeSettings;
  /** Vide tant que la playlist n'est pas envoyée. */
  spotifyPlaylistId: string | null;
  /** Dates ISO 8601. */
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  tracks: PieceTrack[];
  rejected: RejectedTrack[];
};

/** Ce que la liste de « Mes pièces » affiche, sans les titres. */
export type PieceSummary = Omit<PieceRecord, 'tracks' | 'rejected'> & { trackCount: number };

/** Un moule : un minerai et ses réglages, à relancer en un geste. */
export type Mold = {
  id: string;
  ownerSpotifyId: string;
  name: string;
  prompt: string;
  settings: ForgeSettings;
  createdAt: string;
};

/** Toutes les opérations sont limitées au compte `ownerSpotifyId`. */
export interface PieceRepository {
  /** Crée ou remplace la pièce et ses titres. */
  save(piece: PieceRecord): Promise<void>;
  findById(ownerSpotifyId: string, id: string): Promise<PieceRecord | null>;
  /** Les plus récentes d'abord. */
  list(ownerSpotifyId: string): Promise<PieceSummary[]>;
  delete(ownerSpotifyId: string, id: string): Promise<void>;
}

export interface MoldRepository {
  save(mold: Mold): Promise<void>;
  findById(ownerSpotifyId: string, id: string): Promise<Mold | null>;
  /** Les plus récents d'abord. */
  list(ownerSpotifyId: string): Promise<Mold[]>;
  rename(ownerSpotifyId: string, id: string, name: string): Promise<void>;
  delete(ownerSpotifyId: string, id: string): Promise<void>;
}
