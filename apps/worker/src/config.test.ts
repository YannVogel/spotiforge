import { describe, expect, it } from 'vitest';

import { parseWorkerConfig } from './config';

const validEnv = {
  ANTHROPIC_API_KEY: 'fake-anthropic-key',
  ALLOWED_SPOTIFY_IDS: 'fake-account-1,fake-account-2',
  CLAUDE_MODEL: 'fake-model',
};

describe('parseWorkerConfig', () => {
  it('renvoie la configuration quand tout est renseigné', () => {
    const result = parseWorkerConfig(validEnv);

    expect(result).toEqual({
      ok: true,
      config: {
        anthropicApiKey: 'fake-anthropic-key',
        allowedSpotifyIds: new Set(['fake-account-1', 'fake-account-2']),
        claudeModel: 'fake-model',
      },
    });
  });

  it('nettoie la liste des comptes autorisés', () => {
    const result = parseWorkerConfig({ ...validEnv, ALLOWED_SPOTIFY_IDS: ' a , ,b,, ' });

    expect(result.ok && [...result.config.allowedSpotifyIds]).toEqual(['a', 'b']);
  });

  it('ignore les variables inconnues', () => {
    const result = parseWorkerConfig({ ...validEnv, OTHER: 'x' });

    expect(result.ok).toBe(true);
  });

  it('nomme chaque variable absente', () => {
    const result = parseWorkerConfig({});

    expect(result).toEqual({
      ok: false,
      problems: [
        'ANTHROPIC_API_KEY is missing',
        'ALLOWED_SPOTIFY_IDS is missing',
        'CLAUDE_MODEL is missing',
      ],
    });
  });

  it('traite une valeur vide comme absente', () => {
    const result = parseWorkerConfig({ ...validEnv, ANTHROPIC_API_KEY: '  ' });

    expect(result).toEqual({ ok: false, problems: ['ANTHROPIC_API_KEY is missing'] });
  });

  it('refuse une liste de comptes vide', () => {
    const result = parseWorkerConfig({ ...validEnv, ALLOWED_SPOTIFY_IDS: ' , ' });

    expect(result).toEqual({
      ok: false,
      problems: ['ALLOWED_SPOTIFY_IDS must list at least one Spotify account id'],
    });
  });

  it('ne recopie jamais une valeur dans les problèmes', () => {
    const result = parseWorkerConfig({ ...validEnv, CLAUDE_MODEL: 42 });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('fake-anthropic-key');
    expect(JSON.stringify(result)).not.toContain('fake-account-1');
  });
});
