import { AppConfigError, parseAppConfig } from './app-config';

const validEnv = {
  EXPO_PUBLIC_SPOTIFY_CLIENT_ID: 'fake-client-id',
  EXPO_PUBLIC_WORKER_URL: 'https://forge.example.test',
};

function configError(env: Parameters<typeof parseAppConfig>[0]): AppConfigError {
  try {
    parseAppConfig(env);
  } catch (error) {
    if (error instanceof AppConfigError) return error;
    throw error;
  }
  throw new Error('parseAppConfig aurait dû échouer');
}

describe('parseAppConfig', () => {
  it('renvoie la configuration quand tout est renseigné', () => {
    expect(parseAppConfig(validEnv)).toEqual({
      spotifyClientId: 'fake-client-id',
      workerUrl: 'https://forge.example.test',
      redirectScheme: 'spotiforge',
    });
  });

  it("nettoie les espaces et le « / » final de l'URL du Worker", () => {
    const config = parseAppConfig({
      EXPO_PUBLIC_SPOTIFY_CLIENT_ID: '  fake-client-id ',
      EXPO_PUBLIC_WORKER_URL: 'http://192.168.1.10:8787/ ',
    });

    expect(config.spotifyClientId).toBe('fake-client-id');
    expect(config.workerUrl).toBe('http://192.168.1.10:8787');
  });

  it('nomme une valeur absente', () => {
    const error = configError({ EXPO_PUBLIC_WORKER_URL: validEnv.EXPO_PUBLIC_WORKER_URL });

    expect(error.message).toContain('EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing');
    expect(error.message).not.toContain('EXPO_PUBLIC_WORKER_URL');
  });

  it('traite une valeur vide comme absente', () => {
    const error = configError({ ...validEnv, EXPO_PUBLIC_SPOTIFY_CLIENT_ID: '   ' });

    expect(error.message).toContain('EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing');
  });

  it('refuse une URL de Worker sans http(s)', () => {
    const error = configError({ ...validEnv, EXPO_PUBLIC_WORKER_URL: 'forge.example.test' });

    expect(error.message).toContain('EXPO_PUBLIC_WORKER_URL must be an http(s) URL');
  });

  it('nomme toutes les valeurs fautives et indique le fichier à copier', () => {
    const error = configError({});

    expect(error.message).toContain('EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing');
    expect(error.message).toContain('EXPO_PUBLIC_WORKER_URL is missing');
    expect(error.message).toContain('apps/mobile/.env.example');
  });
});
