import { APP_NAME, type HealthResponse } from '@spotiforge/shared';

import { parseWorkerConfig } from './config';

export default {
  async fetch(request, env): Promise<Response> {
    const configResult = parseWorkerConfig(env);
    if (!configResult.ok) {
      // Les problèmes ne citent que des noms de variables : aucun secret dans les logs.
      console.error(`Invalid worker configuration: ${configResult.problems.join('; ')}`);
      return Response.json({ error: 'misconfigured' }, { status: 500 });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      const body: HealthResponse = { status: 'ok', app: APP_NAME };
      return Response.json(body);
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
