# CLAUDE.md

Spotiforge : app perso Expo (Android + iOS) qui génère des playlists par IA et les écrit sur le compte Spotify de l'utilisateur. Cinq comptes au maximum, pas de publication sur les stores.

Les règles de travail sont dans [`AGENTS.md`](AGENTS.md). Lis-le en entier avant de toucher au code : ce fichier-ci n'en est que le résumé.

## Avant de coder

1. Lis l'issue GitHub que tu traites, puis son epic.
2. Lis les docs citées dans l'issue. À défaut :
   - produit : [`docs/PRODUCT.md`](docs/PRODUCT.md)
   - structure et flux : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
   - tout appel Spotify : [`docs/SPOTIFY_API.md`](docs/SPOTIFY_API.md)
   - tout appel au LLM : [`docs/GENERATION.md`](docs/GENERATION.md)
   - toute interface : [`docs/DESIGN.md`](docs/DESIGN.md) et [`design/`](design/)
3. Pour une API de bibliothèque (Expo, React Native, Cloudflare, SDK Anthropic, Spotify), vérifie la documentation à jour avant d'écrire. Ne code pas une signature de mémoire.

## Règles qui ne se négocient pas

- **Langue** : toute la prose est en français (docs, issues, PR, commentaires, messages de commit). Le code, les identifiants, les logs et les termes techniques restent en anglais.
- **Tests** : une fonctionnalité sans tests n'est pas terminée. Les tests s'écrivent avec le code, dans la même PR.
- **Secrets** : aucune clé, aucun jeton, aucun identifiant de compte Spotify dans le repo. Le repo est public.
- **Clé Anthropic** : elle ne vit que dans le Worker. L'app n'appelle jamais l'API Anthropic directement.
- **Spotify** : n'utilise que les endpoints listés dans `docs/SPOTIFY_API.md`. Plusieurs endpoints classiques ont été retirés ou renommés en 2026.
- **Design** : l'interface suit les maquettes Braise et les tokens de `design/tokens.json`. Pas de couleur ni de police hors tokens.
- **Nom** : le projet s'appelle Spotiforge. Les textes de l'interface utilisent le vocabulaire de la forge défini dans `docs/DESIGN.md`.
- **Périmètre** : une issue, une PR. Ce qui sort du périmètre devient une nouvelle issue, pas du code en plus.

## Commandes

Prérequis : Node 22.13 ou plus, pnpm 11 (activé par `corepack enable`, version fixée dans `package.json`).

```bash
pnpm install                                # installe les trois paquets du monorepo
cp apps/mobile/.env.example apps/mobile/.env              # configuration de l'app (voir README)
cp apps/worker/.dev.vars.example apps/worker/.dev.vars     # secrets locaux du Worker (voir README)
pnpm mobile                                 # lance Metro (Expo) pour l'app
pnpm worker                                 # lance le Worker en local (http://localhost:8787)
pnpm lint                                   # ESLint puis Prettier en vérification, sur tout le repo
pnpm format                                 # reformate avec Prettier
pnpm typecheck                              # typecheck des trois paquets
pnpm test                                   # Jest (app) et Vitest (Worker, shared)
pnpm --filter @spotiforge/mobile test -- <motif>   # un seul paquet, un seul fichier
pnpm --filter @spotiforge/worker evaluate   # évaluation manuelle et payante du prompt (docs/GENERATION.md), jamais en CI
pnpm --filter @spotiforge/worker types      # régénère worker-configuration.d.ts après une modification de wrangler.jsonc
```

ESLint interdit à `apps/mobile/src/domain/` d'importer React, React Native, Expo ou `infra/`.

La CI (`.github/workflows/ci.yml`) lance `pnpm lint`, `pnpm typecheck` et `pnpm test` sur chaque PR et sur `main`.
