# API Spotify

État vérifié le 11 novembre 2026 dans le [guide de migration de février 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) et le [billet de juillet 2026 sur les quotas](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates), complété le 12 novembre 2026 par la [liste des changements de février 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) et la référence de chaque endpoint. Cette API change souvent : revérifie avant d'ajouter un appel.

## Le cadre : mode développement

Spotiforge tourne en **mode développement**, le seul accessible à un développeur indépendant.

- Le propriétaire de l'app Spotify doit avoir un abonnement **Premium actif**. S'il s'arrête, l'app ne fonctionne plus pour personne.
- **5 utilisateurs autorisés** au maximum par app, ajoutés à la main dans le dashboard développeur.
- Le quota de requêtes est partagé entre toutes les apps en mode développement du compte développeur.
- Le mode étendu (app ouverte au public) exige une entreprise et 250 000 utilisateurs actifs par mois. Il est hors de portée et hors sujet.

Conséquence : l'app doit ménager le quota (pas de rafales, cache local, reprise sur `429` en respectant `Retry-After`).

## Authentification

- Flux **Authorization Code avec PKCE**, sans secret client dans l'app.
- Jetons d'accès et de rafraîchissement dans le stockage sécurisé du téléphone.
- URI de redirection à déclarer dans le dashboard, pour le schéma de l'app et pour le développement.

### Scopes demandés

| Scope | Pour quoi |
|---|---|
| `playlist-modify-private` | Créer et modifier les playlists privées |
| `playlist-modify-public` | Idem si la personne rend la playlist publique |
| `user-top-read` | « Mes écoutes » : artistes et titres les plus écoutés |
| `user-read-recently-played` | « Mes écoutes » : écoutes récentes |
| `user-library-read` | Savoir si un titre est déjà dans la bibliothèque (mention « connu ») |

N'en demande pas d'autres sans raison écrite ici.

## Endpoints utilisés

| Besoin | Endpoint | Statut |
|---|---|---|
| Identité du compte | `GET /me` | Confirmé. Ne renvoie plus `email`, `country`, `product`, `followers` |
| Recherche d'un titre | `GET /search?type=track` | Confirmé. `limit` : 10 au maximum, 5 par défaut |
| Détail d'un titre | `GET /tracks/{id}` | Confirmé. Un seul identifiant par appel |
| Créer une playlist | `POST /me/playlists` | Confirmé |
| Ajouter des titres | `POST /playlists/{id}/items` | Confirmé |
| Remplacer les titres | `PUT /playlists/{id}/items` | Confirmé |
| Lire les titres d'une playlist | `GET /playlists/{id}/items` | Confirmé, pour les playlists possédées ou collaboratives |
| Titre dans la bibliothèque ? | `GET /me/library/contains` | Confirmé (remplace `/me/tracks/contains`). URI Spotify séparées par des virgules, **40 au maximum** par appel |
| Artistes et titres les plus écoutés | `GET /me/top/{type}` | Documenté : listé parmi les endpoints maintenus (« Personalisation »). `limit` : 50 au maximum. **Pas encore constaté sur un vrai compte** |
| Écoutes récentes | `GET /me/player/recently-played` | Documenté : listé parmi les endpoints maintenus (« Player »). `limit` : 50 au maximum. **Pas encore constaté sur un vrai compte** |
| Modifier nom et description | `PUT /playlists/{id}` | Documenté : listé parmi les endpoints maintenus (« Library »). **Pas encore constaté sur un vrai compte** |

« Documenté » : l'endpoint figure dans la [liste des changements de février 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026), section « Endpoints still available », absente du guide de migration. Il reste à le constater sur un vrai compte en mode développement (issue de vérification de l'API, milestone M0), qui passe alors ces lignes en « Confirmé ».

Champs retirés de l'objet artiste en février 2026 : `followers` et `popularity`. `genres` n'est pas dans la liste des retraits ; le code le traite quand même comme facultatif.

## Ce qui n'existe plus : ne pas utiliser

| Retiré ou renommé | À la place |
|---|---|
| `POST /users/{user_id}/playlists` | `POST /me/playlists` |
| `POST`, `PUT`, `DELETE`, `GET /playlists/{id}/tracks` | Les mêmes verbes sur `/playlists/{id}/items` |
| `GET /tracks?ids=…` (lot) | `GET /tracks/{id}`, un par un |
| `GET /me/tracks/contains` | `GET /me/library/contains` |
| `GET /artists/{id}/top-tracks` | Rien |
| `GET /users/{id}`, `GET /users/{id}/playlists` | `GET /me`, `GET /me/playlists` |
| Recommandations, audio features, audio analysis (retirés fin 2024) | Rien : c'est le LLM qui choisit et ordonne |
| Champ `popularity` des titres, albums, artistes | Rien |
| Champs `available_markets`, `linked_from` des titres | Rien |
| Champ `tracks` d'une playlist | Renommé `items` |

L'extrait audio `preview_url` n'est plus fourni aux apps récentes. L'app ne s'appuie pas dessus.

## Règles d'usage dans le code

- Un seul module `infra/spotify` parle à Spotify. Le reste du code passe par lui.
- Chaque réponse est validée par un schéma. Un champ absent ne doit pas faire planter l'app : les champs retirés ci-dessus sont la preuve qu'ils disparaissent.
- Résolution des titres : une recherche par titre candidat, à concurrence limitée (3 requêtes en parallèle au plus), avec cache local par couple artiste/titre.
- Sur `401` : rafraîchir le jeton une fois, puis rejouer. Sur `429` : attendre `Retry-After`. Sur `403` à l'écriture : la personne n'est sans doute pas dans la liste des 5 comptes autorisés, le dire clairement.
- `POST` et `PUT /playlists/{id}/items` acceptent **100 URI au plus** par appel (référence de chaque endpoint), à passer dans le corps de la requête : découper les envois au-delà. `GET /me/library/contains` en accepte **40 au plus**.
