import { z } from 'zod';

import type { Account } from '../../domain/session';

// Schémas tolérants : seuls les champs utilisés sont exigés ; les champs retirés par Spotify
// (docs/SPOTIFY_API.md) ou ajoutés plus tard ne cassent rien.

export const meSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().nullish(),
});

export function toAccount(me: z.output<typeof meSchema>): Account {
  return { id: me.id, displayName: me.display_name ?? null };
}
