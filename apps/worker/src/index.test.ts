import type { HealthResponse } from '@spotiforge/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeForgeRequest, makeForgeResponse } from '@spotiforge/shared/testing';

import { sha256Hex } from './fingerprint';
import { messageReply } from './forge/fake-anthropic';
import worker from './index';
import type { SlotVerdict } from './limit/sliding-window';

/** Namespace simulé du Durable Object `ForgeLimiter` : garde les noms d'instance demandés. */
function fakeLimiter(verdict: SlotVerdict = { allowed: true }) {
  const names: string[] = [];
  const namespace = {
    getByName: (name: string) => {
      names.push(name);
      return { take: async () => verdict };
    },
  };
  return { names, namespace: namespace as unknown as Env['FORGE_LIMITER'] };
}

const validEnv = {
  ANTHROPIC_API_KEY: 'fake-anthropic-key',
  ALLOWED_SPOTIFY_IDS: 'fake-account-1',
  CLAUDE_MODEL: 'fake-model',
  FORGE_LIMITER: fakeLimiter().namespace,
} satisfies Env;

function call(
  method: string,
  path: string,
  env: Env = validEnv,
  headers: HeadersInit = {},
): Promise<Response> {
  return worker.fetch(new Request(`http://localhost${path}`, { method, headers }), env);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GET /health', () => {
  it('répond 200 avec le statut du Worker', async () => {
    const response = await call('GET', '/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<HealthResponse>({ status: 'ok', app: 'Spotiforge' });
  });

  it('ne répond qu’en GET : une autre méthode est une route protégée', async () => {
    const response = await call('POST', '/health');

    expect(response.status).toBe(401);
  });
});

describe('routes protégées', () => {
  it('répondent 401 sans jeton, sans appeler Spotify', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await call('GET', '/inconnue');

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('répondent 403 à un compte hors liste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'fake-account-other' })),
    );

    const response = await call('GET', '/inconnue', validEnv, {
      Authorization: 'Bearer token-other',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('laissent passer un compte autorisé (404 : la route n’existe pas encore)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'fake-account-1' })),
    );

    const response = await call('GET', '/inconnue', validEnv, {
      Authorization: 'Bearer token-allowed',
    });

    expect(response.status).toBe(404);
  });
});

it('ne demande pas de jeton pour /health', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);

  expect((await call('GET', '/health')).status).toBe(200);
  expect(fetch).not.toHaveBeenCalled();
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

describe('POST /forge', () => {
  const body = JSON.stringify(makeForgeRequest());

  it('exige un compte autorisé avant de lire la requête', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await worker.fetch(
      new Request('http://localhost/forge', { method: 'POST', body }),
      validEnv,
    );

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  /** Spotify et Claude simulés au niveau HTTP. */
  function stubUpstreams() {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new Request(input).url;
      if (url.startsWith('https://api.spotify.com/v1/me')) {
        return Response.json({ id: 'fake-account-1' });
      }
      if (url.startsWith('https://api.anthropic.com/v1/messages')) {
        return messageReply(JSON.stringify(makeForgeResponse()));
      }
      throw new Error(`Unexpected request to ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  const forge = (env: Env, token = 'token-forge') =>
    worker.fetch(
      new Request('http://localhost/forge', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );

  it('renvoie une ForgeResponse pour un compte autorisé (Spotify et Claude simulés)', async () => {
    const fetch = stubUpstreams();
    const limiter = fakeLimiter();

    const response = await forge({ ...validEnv, FORGE_LIMITER: limiter.namespace });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(makeForgeResponse());
    expect(fetch).toHaveBeenCalledTimes(2);
    // Le compteur du compte est nommé par l'empreinte de son identifiant, jamais par l'identifiant.
    expect(limiter.names).toEqual([await sha256Hex('fake-account-1')]);
  });

  it('répond 429 avec Retry-After au-delà de la limite, sans appeler Claude', async () => {
    const fetch = stubUpstreams();
    const limiter = fakeLimiter({ allowed: false, retryAfterSeconds: 600 });

    const response = await forge({ ...validEnv, FORGE_LIMITER: limiter.namespace }, 'token-429');

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('600');
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(fetch.mock.calls.map(([input]) => new Request(input).url)).toEqual([
      'https://api.spotify.com/v1/me',
    ]);
  });

  it('ne consulte pas le compteur pour un compte refusé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'fake-account-other' })),
    );
    const limiter = fakeLimiter();

    const response = await forge({ ...validEnv, FORGE_LIMITER: limiter.namespace }, 'token-other');

    expect(response.status).toBe(403);
    expect(limiter.names).toEqual([]);
  });
});

describe('CORS', () => {
  // L'app mobile n'en a pas besoin : aucune réponse n'autorise une origine, et un navigateur
  // refuse donc tout appel venu d'une page web.
  const corsHeaders = (response: Response) =>
    [...response.headers.keys()].filter((name) => name.startsWith('access-control-'));

  it('n’autorise aucune origine, même sur /health', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/health', { headers: { Origin: 'https://site.example' } }),
      validEnv,
    );

    expect(response.status).toBe(200);
    expect(corsHeaders(response)).toEqual([]);
  });

  it('fait échouer la requête préalable d’un navigateur sur /forge', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await worker.fetch(
      new Request('http://localhost/forge', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://site.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      }),
      validEnv,
    );

    expect(response.ok).toBe(false);
    expect(corsHeaders(response)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
