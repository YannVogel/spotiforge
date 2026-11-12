import { forgeSettingsSchema } from '@spotiforge/shared';
import { z } from 'zod';

// Validation des lignes lues : rien n'entre dans le domaine sans passer par ces schémas.

const sqliteBoolean = z
  .number()
  .int()
  .min(0)
  .max(1)
  .transform((value) => value === 1);

/** Colonne TEXT qui contient du JSON, validé par `schema`. */
function jsonColumn<T extends z.ZodType>(schema: T) {
  return z.string().transform((json, context): z.output<T> => {
    try {
      return schema.parse(JSON.parse(json));
    } catch {
      context.addIssue({ code: 'custom', message: 'invalid JSON column' });
      return z.NEVER;
    }
  });
}

const settingsColumn = jsonColumn(forgeSettingsSchema);

export const pieceRowSchema = z.object({
  id: z.string(),
  owner_spotify_id: z.string(),
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  settings: settingsColumn,
  spotify_playlist_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  sent_at: z.string().nullable(),
});

export const pieceSummaryRowSchema = pieceRowSchema.extend({ track_count: z.number().int() });

export const pieceTrackRowSchema = z.object({
  spotify_uri: z.string(),
  title: z.string(),
  artist: z.string(),
  year: z.number().int(),
  duration_ms: z.number().int().nonnegative(),
  reason: z.string(),
  slot: z.number(),
  known: sqliteBoolean,
  quenched: sqliteBoolean,
});

export const rejectedTrackRowSchema = z.object({
  spotify_uri: z.string(),
  artist: z.string(),
  title: z.string(),
});

export const moldRowSchema = z.object({
  id: z.string(),
  owner_spotify_id: z.string(),
  name: z.string(),
  prompt: z.string(),
  settings: settingsColumn,
  created_at: z.string(),
});

export const trackCacheRowSchema = z.object({
  spotify_uri: z.string().nullable(),
  title: z.string().nullable(),
  artists: jsonColumn(z.array(z.string()).min(1)).nullable(),
  year: z.number().int().nullable(),
  duration_ms: z.number().int().nullable(),
  resolved_at: z.string(),
});

/** Erreur de lecture : la ligne ne respecte pas le schéma. Le message ne recopie aucune valeur. */
export class CorruptedRowError extends Error {
  override name = 'CorruptedRowError';

  constructor(table: string, error: z.ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join('.')))].join(', ');
    super(`Corrupted row in ${table} (${fields})`);
  }
}

export function parseRow<T extends z.ZodType>(schema: T, table: string, row: unknown): z.output<T> {
  const result = schema.safeParse(row);
  if (!result.success) throw new CorruptedRowError(table, result.error);
  return result.data;
}
