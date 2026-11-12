import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/testing/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // `evaluation/run.ts` n'est pas un test : il n'est lancé qu'à la main (vrais appels, payants).
    include: ['src/**/*.test.ts', 'evaluation/**/*.test.ts'],
  },
});
