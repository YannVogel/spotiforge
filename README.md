# Spotiforge

App perso Android + iOS qui forge des playlists sur mesure avec une IA, directement sur le compte Spotify de la personne connectée.

Tu décris un moment, tu règles quatre curseurs, l'IA compose. Tu « trempes » les titres que tu gardes, tu reforges les autres, puis tu envoies la playlist sur Spotify.

> Projet personnel, non distribué sur les stores, sans lien avec Spotify AB. Limité à 5 comptes par le mode développement de l'API Spotify.

## État

Démarrage. Le monorepo est en place (`apps/mobile`, `apps/worker`, `packages/shared`), sans fonctionnalité pour l'instant. Commandes d'installation et de lancement : section « Commandes » de [`CLAUDE.md`](CLAUDE.md).

## Configuration

Le repo est public : aucune valeur réelle n'y est versionnée. Après un clone, copier les deux modèles puis remplacer les valeurs factices :

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

| Où | Valeur | Rôle |
|---|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Identifiant client de l'app Spotify (dashboard développeur) |
| `apps/mobile/.env` | `EXPO_PUBLIC_WORKER_URL` | URL du Worker de forge |
| `apps/mobile/app.json` | `scheme` | Schéma de l'app (`spotiforge`), base de l'URI de redirection Spotify |
| `apps/worker/.dev.vars` | `ANTHROPIC_API_KEY` | Secret : clé de l'API Anthropic |
| `apps/worker/.dev.vars` | `ALLOWED_SPOTIFY_IDS` | Secret : comptes Spotify autorisés, séparés par des virgules |
| `apps/worker/wrangler.jsonc` | `CLAUDE_MODEL` | Variable non secrète : modèle Claude utilisé |

URI de redirection à déclarer dans le dashboard Spotify (connexion en PKCE) : `spotiforge://callback` pour un build, y compris de développement ; dans Expo Go, `exp://<adresse IP de l'ordinateur>:8081/--/callback` (elle change avec l'adresse IP).

Les variables `EXPO_PUBLIC_*` sont intégrées au bundle de l'app : elles ne doivent contenir aucun secret. En production, les secrets du Worker se posent avec `pnpm --filter @spotiforge/worker exec wrangler secret put <NOM>`.

Une valeur manquante ou invalide est signalée par son nom : l'app s'arrête au démarrage avec une `AppConfigError`, le Worker répond `500 misconfigured` et journalise le nom de la variable (jamais sa valeur).

## Où lire quoi

| Fichier | Contenu |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Point d'entrée des agents de code |
| [`AGENTS.md`](AGENTS.md) | Règles de travail : conventions, tests, workflow par issue |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Ce que fait la v1, et ce qu'elle ne fait pas |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Monorepo, flux, modèle de données |
| [`docs/SPOTIFY_API.md`](docs/SPOTIFY_API.md) | Contraintes et endpoints Spotify (mode développement) |
| [`docs/GENERATION.md`](docs/GENERATION.md) | Contrat entre l'app, le Worker et le LLM |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Direction artistique « Braise » et vocabulaire |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones et epics |
| [`design/`](design/) | Maquettes sources et tokens |

## Stack

Expo (React Native, TypeScript) pour l'app, un Cloudflare Worker pour l'appel au LLM (Claude), SQLite sur le téléphone pour l'historique. Détails dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
