import { z } from 'zod';

const MISSING = 'is missing';

const workerEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string(MISSING).trim().min(1, MISSING),
  ALLOWED_SPOTIFY_IDS: z
    .string(MISSING)
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(z.string()).min(1, 'must list at least one Spotify account id')),
  CLAUDE_MODEL: z.string(MISSING).trim().min(1, MISSING),
});

export type WorkerConfig = {
  anthropicApiKey: string;
  allowedSpotifyIds: ReadonlySet<string>;
  claudeModel: string;
};

export type WorkerConfigResult =
  | { ok: true; config: WorkerConfig }
  /** Problèmes décrits par le nom de la variable seulement, jamais par sa valeur. */
  | { ok: false; problems: string[] };

export function parseWorkerConfig(env: unknown): WorkerConfigResult {
  const result = workerEnvSchema.safeParse(env);
  if (!result.success) {
    return {
      ok: false,
      problems: result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    };
  }

  return {
    ok: true,
    config: {
      anthropicApiKey: result.data.ANTHROPIC_API_KEY,
      allowedSpotifyIds: new Set(result.data.ALLOWED_SPOTIFY_IDS),
      claudeModel: result.data.CLAUDE_MODEL,
    },
  };
}
