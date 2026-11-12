export * from './forge';

export const APP_NAME = 'Spotiforge';

/** Réponse de `GET /health` sur le Worker. */
export type HealthResponse = {
  status: 'ok';
  app: typeof APP_NAME;
};
