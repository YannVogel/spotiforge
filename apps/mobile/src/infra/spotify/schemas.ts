import { z } from 'zod';

import type { CatalogTrack } from '../../domain/match';
import type { Account } from '../../domain/session';
import type { ListenedArtist } from '../../domain/taste';

// Schémas tolérants : seuls les champs utilisés sont exigés ; les champs retirés par Spotify
// (docs/SPOTIFY_API.md) ou ajoutés plus tard ne cassent rien.

export const meSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().nullish(),
});

export function toAccount(me: z.output<typeof meSchema>): Account {
  return { id: me.id, displayName: me.display_name ?? null };
}

const searchItemSchema = z.object({
  uri: z.string().min(1),
  name: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  artists: z.array(z.object({ name: z.string().min(1) })).min(1),
  album: z.object({ release_date: z.string().nullish() }).nullish(),
});

/** Les éléments sont validés un par un : un résultat incomplet est ignoré, pas la recherche. */
export const searchTracksSchema = z.object({
  tracks: z.object({ items: z.array(z.unknown()) }),
});

/** `release_date` vaut « 1975 », « 1975-10 » ou « 1975-10-31 » selon la précision connue. */
function releaseYear(releaseDate: string | null | undefined): number | undefined {
  const year = Number(releaseDate?.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : undefined;
}

export function toCatalogTracks(search: z.output<typeof searchTracksSchema>): CatalogTrack[] {
  return search.tracks.items.flatMap((item) => {
    const parsed = searchItemSchema.safeParse(item);
    if (!parsed.success) return [];
    const track = parsed.data;
    const year = releaseYear(track.album?.release_date);
    return [
      {
        spotifyUri: track.uri,
        title: track.name,
        artists: track.artists.map((artist) => artist.name),
        durationMs: track.duration_ms,
        ...(year !== undefined && { year }),
      },
    ];
  });
}

/** Page d'éléments validés un par un : un élément incomplet (ou `null`) est ignoré, pas la page. */
export const itemsPageSchema = z.object({ items: z.array(z.unknown()) });

function parseEach<T extends z.ZodType>(items: readonly unknown[], schema: T): z.output<T>[] {
  return items.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// `genres` n'est pas dans la liste des champs retirés en 2026, mais rien ne garantit sa présence.
const topArtistSchema = z.object({
  name: z.string().min(1),
  genres: z.array(z.string()).nullish(),
});

export function toListenedArtists(page: z.output<typeof itemsPageSchema>): ListenedArtist[] {
  return parseEach(page.items, topArtistSchema).map((artist) => ({
    name: artist.name,
    genres: artist.genres ?? [],
  }));
}

// Seuls les noms d'artistes sont lus : ni l'heure d'écoute (`played_at`), ni le contexte.
const recentlyPlayedItemSchema = z.object({
  track: z.object({ artists: z.array(z.object({ name: z.string().min(1) })) }),
});

export function toRecentArtistNames(page: z.output<typeof itemsPageSchema>): string[] {
  return parseEach(page.items, recentlyPlayedItemSchema).flatMap(({ track }) =>
    track.artists.map((artist) => artist.name),
  );
}

/** `GET /me/library/contains` : un booléen par URI demandée, dans le même ordre. */
export const libraryContainsSchema = z.array(z.boolean());
