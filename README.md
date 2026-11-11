# Spotiforge

App perso Android + iOS qui forge des playlists sur mesure avec une IA, directement sur le compte Spotify de la personne connectée.

Tu décris un moment, tu règles quatre curseurs, l'IA compose. Tu « trempes » les titres que tu gardes, tu reforges les autres, puis tu envoies la playlist sur Spotify.

> Projet personnel, non distribué sur les stores, sans lien avec Spotify AB. Limité à 5 comptes par le mode développement de l'API Spotify.

## État

Démarrage. Aucun code applicatif pour l'instant : le repo contient le cadrage, le design et le backlog (issues, epics, milestones).

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
