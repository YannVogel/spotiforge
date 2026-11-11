import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

// Le domaine reste pur : ni React, ni Expo, ni accès au monde extérieur (docs/ARCHITECTURE.md).
const domainBoundaries = {
  patterns: [
    {
      regex: '^(react|react-native|expo)($|[-/])|^@(expo|react-native|react-navigation)/',
      message: 'domain/ ne dépend ni de React ni d’Expo : déplace ce code dans features/ ou ui/.',
    },
    {
      regex: '(^|/)infra($|/)',
      message:
        'domain/ ne dépend pas de infra/ : définis une interface dans domain/ et implémente-la dans infra/.',
    },
  ],
};

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.expo/',
    '**/.wrangler/',
    'apps/mobile/ios/',
    'apps/mobile/android/',
    'apps/worker/worker-configuration.d.ts',
  ]),
  {
    basePath: 'apps/mobile',
    extends: [expoConfig],
  },
  {
    files: ['apps/worker/**/*.ts', 'packages/shared/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // AGENTS.md : pas de `any`, pas de `@ts-ignore` sans commentaire qui explique pourquoi.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description', 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
  {
    files: ['apps/mobile/src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', domainBoundaries],
    },
  },
  prettierConfig,
]);
