# Spotiforge

App perso Android + iOS qui forge des playlists sur mesure avec une IA, directement sur le compte Spotify de la personne connectée.

Tu décris un moment, tu règles quatre curseurs, l'IA compose. Tu « trempes » les titres que tu gardes, tu reforges les autres, puis tu envoies la playlist sur Spotify.

> Projet personnel, non distribué sur les stores, sans lien avec Spotify AB. Limité à 5 comptes par le mode développement de l'API Spotify.

## État

En construction. En place : le monorepo (`apps/mobile`, `apps/worker`, `packages/shared`) avec lint, tests et CI ; le thème Braise et ses composants ; l'écran Création branché sur le brouillon ; le domaine (assemblage, trempe, reforge, correspondance des titres) ; la base locale ; le Worker de forge (`POST /forge`) ; la connexion, la session et le client Spotify, encore non vérifiés sur un vrai compte. Pas encore branchés de bout en bout : la connexion dans l'interface, la forge depuis l'app, l'aperçu et l'envoi. Suite : [`docs/ROADMAP.md`](docs/ROADMAP.md) et les issues.

Commandes d'installation et de lancement : section « Commandes » de [`CLAUDE.md`](CLAUDE.md).

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

Les variables `EXPO_PUBLIC_*` sont intégrées au bundle de l'app : elles ne doivent contenir aucun secret. En production, les secrets du Worker se posent au premier déploiement, puis avec `wrangler secret put` (voir « Déployer le Worker »).

Une valeur manquante ou invalide est signalée par son nom : l'app s'arrête au démarrage avec une `AppConfigError`, le Worker répond `500 misconfigured` et journalise le nom de la variable (jamais sa valeur).

## Déployer le Worker

Prérequis : un compte Cloudflare (l'offre gratuite suffit : elle inclut les Workers et les Durable Objects à stockage SQLite qui comptent les forges), et `apps/worker/.dev.vars` rempli avec les vraies valeurs (voir « Configuration »). Conseillé : une clé Anthropic dédiée à Spotiforge, dans un espace de travail de la console Anthropic doté d'une limite de dépense mensuelle, en plus de la limite de forges du Worker.

Les commandes se lancent depuis la racine du repo ; les chemins passés à Wrangler sont relatifs à `apps/worker`.

1. Se connecter à Cloudflare, une fois par machine :

   ```bash
   pnpm --filter @spotiforge/worker exec wrangler login
   ```

2. Premier déploiement, secrets compris (un déploiement échoue tant qu'un secret de `secrets.required` manque) :

   ```bash
   pnpm --filter @spotiforge/worker exec wrangler deploy --secrets-file .dev.vars
   ```

   Une variable d'environnement du shell portant le même nom (`ANTHROPIC_API_KEY`, par exemple) l'emporte sur le fichier : vérifie qu'elle n'est pas définie. Si le compte n'a pas encore de sous-domaine `workers.dev`, Wrangler en demande un. Il affiche ensuite l'URL du Worker : `https://spotiforge-worker.<sous-domaine>.workers.dev`.

3. Reporter cette URL dans `EXPO_PUBLIC_WORKER_URL` (`apps/mobile/.env`), puis relancer Metro.

4. Vérifier :

   ```bash
   curl https://spotiforge-worker.<sous-domaine>.workers.dev/health
   # {"status":"ok","app":"Spotiforge"}
   curl -i -X POST https://spotiforge-worker.<sous-domaine>.workers.dev/forge
   # 401 : aucun jeton Spotify
   ```

   Puis forger une playlist depuis l'app, connecté avec un compte de `ALLOWED_SPOTIFY_IDS`.

Déploiements suivants : `pnpm --filter @spotiforge/worker exec wrangler deploy`. Les secrets déjà posés sont conservés.

Changer un secret (nouvelle clé Anthropic, compte ajouté ou retiré) :

```bash
pnpm --filter @spotiforge/worker exec wrangler secret put ALLOWED_SPOTIFY_IDS
```

La valeur est demandée à l'invite, jamais passée en argument (elle resterait dans l'historique du shell). Le Worker est redéployé aussitôt. L'identifiant d'un compte Spotify est le « nom d'utilisateur » affiché sur la page du compte Spotify.

Journaux en direct : `pnpm --filter @spotiforge/worker exec wrangler tail` ; ils ne contiennent ni prompt, ni jeton, ni identifiant de compte. Vérifier le paquet sans rien envoyer : `pnpm --filter @spotiforge/worker exec wrangler deploy --dry-run --outdir dist`.

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
