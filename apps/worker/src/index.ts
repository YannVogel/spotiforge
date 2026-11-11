import { APP_NAME, type HealthResponse } from '@spotiforge/shared';

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      const body: HealthResponse = { status: 'ok', app: APP_NAME };
      return Response.json(body);
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
