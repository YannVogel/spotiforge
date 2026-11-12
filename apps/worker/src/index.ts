import { APP_NAME, type HealthResponse } from '@spotiforge/shared';

import { type AuthResult, createAuthenticator, type IdentityCache } from './auth';
import { parseWorkerConfig } from './config';
import { createForgeGenerator } from './forge/generate';
import { handleForge } from './forge/handler';

// Cache d'identités partagé par les requêtes d'un même isolat : uniquement des données simples
// (empreinte du jeton → identifiant de compte, date d'expiration), jamais d'objet de requête.
const identityCache: IdentityCache = new Map();
const authenticate = createAuthenticator({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  cache: identityCache,
});

function authError(result: Extract<AuthResult, { ok: false }>): Response {
  const headers: HeadersInit = result.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {};
  return Response.json({ error: result.error }, { status: result.status, headers });
}

export default {
  async fetch(request, env): Promise<Response> {
    const configResult = parseWorkerConfig(env);
    if (!configResult.ok) {
      // Les problèmes ne citent que des noms de variables : aucun secret dans les logs.
      console.error(`Invalid worker configuration: ${configResult.problems.join('; ')}`);
      return Response.json({ error: 'misconfigured' }, { status: 500 });
    }
    const { config } = configResult;
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      const body: HealthResponse = { status: 'ok', app: APP_NAME };
      return Response.json(body);
    }

    // Toute autre route exige un compte Spotify autorisé.
    const auth = await authenticate(request, config.allowedSpotifyIds);
    if (!auth.ok) return authError(auth);

    if (request.method === 'POST' && url.pathname === '/forge') {
      const generate = createForgeGenerator({
        apiKey: config.anthropicApiKey,
        model: config.claudeModel,
      });
      return handleForge(request, generate);
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
