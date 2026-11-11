import { z } from 'zod';

import { expo } from '../../../app.json';

const MISSING = 'is missing';

// `z.url()` s'appuie sur `URL`, dont l'implémentation React Native est incomplète : on vérifie
// seulement le schéma et la présence d'un hôte.
const HTTP_URL = /^https?:\/\/[^\s/]+/;

const appEnvSchema = z.object({
  EXPO_PUBLIC_SPOTIFY_CLIENT_ID: z.string(MISSING).trim().min(1, MISSING),
  EXPO_PUBLIC_WORKER_URL: z
    .string(MISSING)
    .trim()
    .min(1, MISSING)
    .regex(HTTP_URL, 'must be an http(s) URL'),
});

export type AppEnv = Partial<Record<keyof z.input<typeof appEnvSchema>, string>>;

export type AppConfig = {
  spotifyClientId: string;
  workerUrl: string;
  /** Schéma d'URL de l'app (`app.json`), qui sert à construire l'URI de redirection Spotify. */
  redirectScheme: string;
};

export class AppConfigError extends Error {
  override name = 'AppConfigError';
}

export function parseAppConfig(env: AppEnv): AppConfig {
  const result = appEnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `- ${issue.path.join('.')} ${issue.message}`,
    );
    throw new AppConfigError(
      [
        'Invalid app configuration:',
        ...problems,
        'Copy apps/mobile/.env.example to apps/mobile/.env, fill in the values, then restart Expo.',
      ].join('\n'),
    );
  }

  return {
    spotifyClientId: result.data.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
    workerUrl: result.data.EXPO_PUBLIC_WORKER_URL.replace(/\/+$/, ''),
    redirectScheme: expo.scheme,
  };
}
