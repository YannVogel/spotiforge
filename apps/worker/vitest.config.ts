import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // `evaluation/run.ts` n'est pas un test : il n'est lancé qu'à la main (vrais appels, payants).
    include: ['src/**/*.test.ts', 'evaluation/**/*.test.ts'],
  },
});
