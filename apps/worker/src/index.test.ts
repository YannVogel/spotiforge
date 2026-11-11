import type { HealthResponse } from '@spotiforge/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index';

const validEnv = {
  ANTHROPIC_API_KEY: 'fake-anthropic-key',
  ALLOWED_SPOTIFY_IDS: 'fake-account-1',
  CLAUDE_MODEL: 'fake-model',
} satisfies Env;

function call(method: string, path: string, env: Env = validEnv): Promise<Response> {
  return worker.fetch(new Request(`http://localhost${path}`, { method }), env);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /health', () => {
  it('répond 200 avec le statut du Worker', async () => {
    const response = await call('GET', '/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<HealthResponse>({ status: 'ok', app: 'Spotiforge' });
  });

  it('répond 404 sur une autre méthode', async () => {
    const response = await call('POST', '/health');

    expect(response.status).toBe(404);
  });
});

it('répond 404 sur une route inconnue', async () => {
  const response = await call('GET', '/inconnue');

  expect(response.status).toBe(404);
});

describe('configuration invalide', () => {
  it('répond 500 et journalise le nom de la variable, sans sa valeur', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await call('GET', '/health', { ...validEnv, ANTHROPIC_API_KEY: '' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'misconfigured' });
    expect(consoleError).toHaveBeenCalledWith(
      'Invalid worker configuration: ANTHROPIC_API_KEY is missing',
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('fake-account-1');
  });
});
