import { z } from 'zod';

/** Bornes du contrat de forge. Voir docs/GENERATION.md. */
export const FORGE_LIMITS = {
  prompt: { maxLength: 500 },
  length: {
    minutes: { min: 10, max: 120 },
    tracks: { min: 3, max: 30 },
  },
  discovery: { min: 0, max: 100 },
  tasteArtists: { max: 50 },
  tasteGenres: { max: 20 },
  keep: { max: 100 },
  avoid: { max: 300 },
  text: { maxLength: 200 },
  title: { maxLength: 100 },
  description: { maxLength: 300 },
  reason: { maxLength: 300 },
  year: { min: 1900, max: 2100 },
  candidates: { max: 100 },
} as const;

export const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'] as const;
export const SHAPES = ['rise', 'fall', 'wave', 'free'] as const;
export const LENGTH_UNITS = ['minutes', 'tracks'] as const;
export const DEFAULT_LOCALE = 'fr';

const L = FORGE_LIMITS;

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);

function hasNoDuplicates<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const decadeSchema = z.enum(DECADES);
export const shapeSchema = z.enum(SHAPES);

export const forgeLengthSchema = z.discriminatedUnion('unit', [
  z.object({
    unit: z.literal('minutes'),
    value: z.number().int().min(L.length.minutes.min).max(L.length.minutes.max),
  }),
  z.object({
    unit: z.literal('tracks'),
    value: z.number().int().min(L.length.tracks.min).max(L.length.tracks.max),
  }),
]);

/** Réglages choisis sur l'écran Création ; ils sont aussi gardés avec les pièces et les moules. */
export const forgeSettingsSchema = z.object({
  length: forgeLengthSchema,
  discovery: z.number().int().min(L.discovery.min).max(L.discovery.max),
  /** Vide : toutes les époques. */
  decades: z
    .array(decadeSchema)
    .default([])
    .refine(hasNoDuplicates, { error: 'decades must be unique' }),
  shape: shapeSchema,
  /** « Alliage : mes écoutes ». */
  useTaste: z.boolean(),
});

/** Résumé des écoutes : des noms d'artistes et de genres, rien d'autre. */
export const tasteSchema = z.object({
  topArtists: z.array(text(L.text.maxLength)).max(L.tasteArtists.max),
  recentArtists: z.array(text(L.text.maxLength)).max(L.tasteArtists.max),
  genres: z.array(text(L.text.maxLength)).max(L.tasteGenres.max).default([]),
});

export const trackRefSchema = z.object({
  artist: text(L.text.maxLength),
  title: text(L.text.maxLength),
});

/** Titre trempé : `position` est son index (à partir de 0) dans la pièce. */
export const keptTrackSchema = z.object({
  ...trackRefSchema.shape,
  position: z.number().int().min(0),
});

export const forgeRequestSchema = z.object({
  ...forgeSettingsSchema.omit({ useTaste: true }).shape,
  prompt: text(L.prompt.maxLength),
  taste: tasteSchema.optional(),
  keep: z
    .array(keptTrackSchema)
    .max(L.keep.max)
    .refine((tracks) => hasNoDuplicates(tracks.map((track) => track.position)), {
      error: 'keep positions must be unique',
    })
    .optional(),
  avoid: z.array(trackRefSchema).max(L.avoid.max).optional(),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default(DEFAULT_LOCALE),
});

export const candidateSchema = z.object({
  ...trackRefSchema.shape,
  year: z.number().int().min(L.year.min).max(L.year.max),
  reason: text(L.reason.maxLength),
  /** Place dans la progression : 0 au début, 1 à la fin. */
  slot: z.number().min(0).max(1),
  /** Le LLM pense que la personne connaît ce titre, d'après `taste`. */
  familiar: z.boolean(),
});

export const forgeResponseSchema = z.object({
  title: text(L.title.maxLength),
  description: text(L.description.maxLength),
  candidates: z.array(candidateSchema).min(1).max(L.candidates.max),
});

export type Decade = z.infer<typeof decadeSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export type ForgeLength = z.infer<typeof forgeLengthSchema>;
export type LengthUnit = ForgeLength['unit'];
export type ForgeSettings = z.infer<typeof forgeSettingsSchema>;
export type Taste = z.infer<typeof tasteSchema>;
export type TrackRef = z.infer<typeof trackRefSchema>;
export type KeptTrack = z.infer<typeof keptTrackSchema>;
/** Requête validée, valeurs par défaut appliquées. */
export type ForgeRequest = z.infer<typeof forgeRequestSchema>;
/** Requête telle qu'on peut l'écrire : `decades`, `locale` et `taste.genres` sont facultatifs. */
export type ForgeRequestInput = z.input<typeof forgeRequestSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type ForgeResponse = z.infer<typeof forgeResponseSchema>;
