import { type AppConfig, parseAppConfig } from './app-config';

export { AppConfigError, type AppConfig } from './app-config';

let cached: AppConfig | undefined;

/** Lit et valide la configuration une fois. Lève une `AppConfigError` qui nomme chaque valeur fautive. */
export function getAppConfig(): AppConfig {
  // Expo n'injecte que les accès écrits en toutes lettres (`process.env.EXPO_PUBLIC_X`) :
  // pas de déstructuration ni d'accès dynamique.
  cached ??= parseAppConfig({
    EXPO_PUBLIC_SPOTIFY_CLIENT_ID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
    EXPO_PUBLIC_WORKER_URL: process.env.EXPO_PUBLIC_WORKER_URL,
  });
  return cached;
}
