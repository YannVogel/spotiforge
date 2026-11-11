import type { HealthResponse } from '@spotiforge/shared';
import { describe, expect, it } from 'vitest';

import worker from './index';

function call(method: string, path: string): Promise<Response> {
  return worker.fetch(new Request(`http://localhost${path}`, { method }));
}

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
