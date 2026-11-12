# Architecture

## Vue d'ensemble

```
┌──────────────────────────── Téléphone ────────────────────────────┐
│  App Expo                                                         │
│   ui ◄── features ──► domain ◄── infra                            │
│                                   ├─ spotify   (API Spotify)      │
│                                   ├─ forge     (Worker)           │
│                                   ├─ db        (SQLite)           │
│                                   └─ secure    (jetons)           │
└──────────┬───────────────────────────────┬────────────────────────┘
           │ jeton Spotify de la personne  │ jeton Spotify + demande
           ▼                               ▼
   api.spotify.com                 Cloudflare Worker ──► API Anthropic (Claude)
                                   (ne garde qu'un compteur de forges)
```

Trois acteurs :

- **L'app** fait tout ce qui touche au compte Spotify : connexion, lecture des écoutes, recherche des titres, écriture de la playlist. Elle garde l'historique en local.
- **Le Worker** ne fait qu'une chose : recevoir une demande de forge, appeler Claude, renvoyer une liste de titres candidats. Il existe pour que la clé Anthropic ne soit jamais dans l'app.
- **Spotify** reste la source de vérité des playlists envoyées.

## Monorepo

```
apps/
  mobile/        App Expo (React Native, TypeScript, Expo Router)
  worker/        Cloudflare Worker (TypeScript)
packages/
  shared/        Types et schémas partagés : contrat de forge, réglages
design/          Maquettes sources et tokens (voir docs/DESIGN.md)
docs/
```

Gestionnaire de paquets : pnpm avec workspaces. Les versions exactes (SDK Expo, React Native, Wrangler) se choisissent au moment du scaffold, sur les dernières versions stables, après lecture de leur documentation.

## Couches de l'app

```
apps/mobile/src/
  ui/            Composants Braise sans logique métier (Button, HeatBar, TrackRow…)
  features/      Écrans et orchestration : auth, create, anvil, pieces
  domain/        Logique pure : types, règles de trempe et de reforge, résolution
  infra/         Accès au monde extérieur : spotify, forge, db, secure
```

Règle de dépendance : tout pointe vers le domaine (`features → domain ← infra`, et `features → ui`). Précisément :

- `domain` n'importe rien de React, d'Expo ni du réseau. Il définit les interfaces dont il a besoin (`SpotifyGateway`, `ForgeGateway`, `PieceRepository`).
- `infra` implémente ces interfaces. Elle importe le domaine, jamais l'inverse.
- `features` assemble domaine et infra, et expose des hooks aux écrans. La racine de composition, `features/app/services.ts`, est le seul endroit qui crée l'infra réelle (session, client Spotify, client du Worker, base SQLite) ; tout le reste reçoit ses dépendances, ce qui le garde testable.
- `ui` ne connaît ni Spotify ni le Worker.

## Choix techniques

| Sujet | Choix | Raison |
|---|---|---|
| Navigation | Expo Router | Standard Expo |
| Connexion Spotify | `expo-auth-session`, PKCE | Pas de secret dans l'app |
| Jetons | `expo-secure-store` | Stockage chiffré du système |
| Base locale | `expo-sqlite` | Historique hors ligne, sans serveur |
| Appels réseau | TanStack Query | Cache, reprise, états de chargement |
| État du brouillon | Zustand | Un petit store pour la playlist en cours |
| Validation | Zod | Schémas partagés app et Worker |
| Tests | Jest + React Native Testing Library (app), Vitest (Worker, shared) | Outils par défaut de chaque environnement |
| Worker | Cloudflare Workers | Gratuit à cette échelle, sans serveur à maintenir |

Un choix de ce tableau peut être remis en cause dans une issue, avec la raison. Pas en silence dans une PR.

## Flux de forge

1. L'app construit une `ForgeRequest` (voir [`GENERATION.md`](GENERATION.md)) : prompt, réglages, et, si « mes écoutes » est activé, un résumé des goûts lu sur Spotify.
2. L'app envoie la demande au Worker, avec le jeton d'accès Spotify dans l'en-tête `Authorization`.
3. Le Worker vérifie le jeton en appelant `GET /me` chez Spotify, compare l'identifiant du compte à sa liste autorisée, puis appelle Claude.
4. Le Worker renvoie des **candidats** : titre, artiste, année, raison, et une position dans la progression.
5. L'app **résout** chaque candidat par une recherche Spotify. Les introuvables et les doublons sont écartés.
6. L'app garde le nombre de titres demandé, dans l'ordre de la progression.
7. L'app marque chaque titre retenu « connu » ou « découverte » (bibliothèque et écoutes de la personne), puis affiche l'aperçu. Marquer après l'assemblage évite d'interroger la bibliothèque pour des candidats écartés.

L'orchestration vit dans `features/forge/forge-run.ts` : elle remonte son avancement (écoutes, forge, vérification sur Spotify titre par titre, marquage) pour l'état « forge en cours », s'interrompt à l'annulation et ne touche jamais au brouillon. Le client du Worker est `infra/forge/worker-client.ts`. Chaque échec est traduit en message (`features/forge/failure.ts`, tableau « Erreurs » de [`GENERATION.md`](GENERATION.md)), avec un bouton pour réessayer.

La **reforge** suit le même flux, avec en plus la liste des titres trempés (à conserver, avec leur position) et la liste des titres déjà refusés (à ne pas reproposer). Elle partage le cœur de la forge (`runReforge`, même fichier) : seuls les titres à chaud sont remplacés et marqués, le titre et la description de la pièce ne changent pas, et un échec laisse la pièce telle quelle sur l'enclume. Pendant la reforge, l'écran reste affiché : les titres à chaud s'estompent, la trempe est figée.

## Envoi sur Spotify

`domain/send.ts` écrit la pièce sur le compte : création d'une playlist **privée** (`POST /me/playlists`) si la pièce n'en a pas encore, puis **remplacement** de ses titres par le premier lot de 100 (`PUT /playlists/{id}/items`) et ajout des lots suivants (`POST`). L'identifiant de la playlist est noté sur la pièce dès sa création : un nouvel essai après une panne la réutilise, et le remplacement repart de zéro, donc ni seconde playlist ni doublon. Une pièce envoyée puis modifiée (reforge, titre) peut être renvoyée dans la même playlist ; la mise à jour de son nom et de sa description relève du rafraîchissement.

## Autorisation du Worker

Le Worker n'a pas de comptes à lui. Il s'appuie sur Spotify :

- chaque requête porte un jeton d'accès Spotify valide ;
- le Worker appelle `GET /me` et lit l'identifiant du compte ;
- il refuse tout identifiant absent du secret `ALLOWED_SPOTIFY_IDS` ;
- le résultat de cette vérification est gardé en mémoire quelques minutes pour ne pas doubler chaque appel.

Une limite de forges par compte protège la facture Anthropic : **20 forges acceptées sur toute heure glissante** (`FORGE_LIMIT`, `apps/worker/src/limit/forge-limiter.ts`), `429` au-delà avec l'en-tête `Retry-After`. Seules les requêtes valides comptent, car ce sont elles qui appellent Claude. Le compteur est un Durable Object par compte (binding `FORGE_LIMITER`), nommé par l'empreinte SHA-256 de l'identifiant Spotify et non par l'identifiant. Il ne garde que les dates des forges de l'heure écoulée, et une alarme efface tout une heure après la dernière forge acceptée. C'est la seule donnée que le Worker conserve d'une requête à l'autre. Le binding Rate Limiting de Cloudflare a été écarté : il ne compte que sur 10 ou 60 secondes, par emplacement et de façon approximative. Si le compteur est injoignable, la forge est refusée (`503`) sans appeler Claude.

CORS : le Worker n'envoie aucun en-tête `Access-Control-*`. L'app mobile n'en a pas besoin, et un navigateur refuse donc tout appel venu d'une page web (la requête préalable `OPTIONS` échoue).

Secrets du Worker : `ANTHROPIC_API_KEY`, `ALLOWED_SPOTIFY_IDS`. Variable : `CLAUDE_MODEL`. Procédure de déploiement : [`README.md`](../README.md#déployer-le-worker).

## Modèle de données local

SQLite sur le téléphone (`expo-sqlite`), fichier `spotiforge.db`. Le schéma est créé et mis à jour par des migrations versionnées (`apps/mobile/src/infra/db/migrations.ts`, version dans `PRAGMA user_version`) : une migration publiée ne se modifie plus, on en ajoute une. Clés étrangères actives, dates en texte ISO 8601, booléens en `INTEGER` 0/1. Chaque ligne lue est validée par un schéma Zod avant d'entrer dans le domaine, qui ne connaît que les interfaces `PieceRepository`, `MoldRepository` et `ResolutionCache`.

**`pieces`** : une playlist forgée.

| Champ | Rôle |
|---|---|
| `id` | Identifiant local (clé primaire) |
| `owner_spotify_id` | Compte qui l'a forgée |
| `title`, `description` | Écrits par l'IA, modifiables |
| `prompt` | Le prompt d'origine |
| `settings` | Réglages en JSON (`ForgeSettings` : longueur, découverte, époques, progression, écoutes) |
| `spotify_playlist_id` | Vide tant que la playlist n'est pas envoyée |
| `created_at`, `updated_at`, `sent_at` | Dates (`sent_at` vide tant que la playlist n'est pas envoyée) |

**`piece_tracks`** : les titres d'une pièce, dans l'ordre. Clé `(piece_id, position)`, supprimés avec la pièce.

| Champ | Rôle |
|---|---|
| `piece_id`, `position` | Rattachement et ordre (à partir de 0) |
| `spotify_uri` | Identifiant Spotify du titre |
| `title`, `artist`, `year` | Copie pour l'affichage hors ligne |
| `duration_ms` | Durée, pour couper une pièce en minutes |
| `reason` | « Pourquoi ce titre » |
| `slot` | Place dans la progression (0 à 1), pour les reforges |
| `known` | Connu ou découverte |
| `quenched` | Trempé ou non |

**`rejected_tracks`** : titres refusés pour une pièce (`piece_id`, `position` = ordre du refus, `spotify_uri`, `artist`, `title`), supprimés avec la pièce.

**`molds`** : moules, c'est-à-dire modèles réutilisables (`id`, `owner_spotify_id`, `name`, `prompt`, `settings` en JSON, `created_at`).

**`taste_cache`** : résumé des écoutes (« Alliage : mes écoutes »), une ligne par compte : `owner_spotify_id`, `taste` (JSON au format `Taste` du contrat : noms d'artistes et de genres seulement), `fetched_at`. Relu sur Spotify au plus une fois par jour.

**`track_cache`** : résolutions déjà faites. `query_key` (artiste et titre normalisés), `spotify_uri` (vide : titre introuvable), métadonnées `title`, `artists` (JSON), `year`, `duration_ms`, et `resolved_at`.

La pièce sur l'enclume est enregistrée à chacun de ses changements (première forge, trempe, reforge et refusés, édition, création de la playlist, envoi), une écriture à la fois (`features/pieces/persistence.ts`). Au lancement, l'écran Création propose de reprendre la dernière pièce non envoyée ; revenu de l'enclume, il propose d'y retourner (`features/pieces/resume.ts`).

Les données sont cloisonnées par `owner_spotify_id` : toutes les opérations des dépôts prennent le compte en paramètre, et se déconnecter puis se connecter avec un autre compte ne montre pas l'historique du précédent.

## Erreurs à traiter dès la conception

- Hors ligne : l'historique reste lisible, la forge et l'envoi sont désactivés avec un message clair.
- Jeton expiré ou révoqué : rafraîchissement, sinon retour à la connexion sans perdre le brouillon.
- Compte hors liste autorisée : message explicite, pas d'erreur technique brute.
- Trop peu de titres résolus : relancer une forge complémentaire une fois, puis afficher ce qu'on a.
- Playlist supprimée côté Spotify : proposer de la recréer au prochain rafraîchissement.
