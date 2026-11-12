# Génération

Contrat entre l'app, le Worker et le LLM. Les schémas vivent dans `packages/shared` et sont la référence : ce document les décrit, il ne les remplace pas.

## Principe

Le LLM propose, Spotify vérifie. Claude ne voit jamais le catalogue Spotify : il renvoie des couples artiste/titre plausibles, et l'app garde ceux qui existent. On demande donc plus de titres que nécessaire.

## Requête : `ForgeRequest`

Envoyée par l'app au Worker (`POST /forge`).

| Champ | Type | Rôle |
|---|---|---|
| `prompt` | texte | Le moment décrit par la personne |
| `length` | `{ unit: "minutes" \| "tracks", value }` | Longueur visée |
| `discovery` | entier de 0 à 100 | Part de découvertes souhaitée |
| `decades` | liste parmi `60s` … `20s` | Vide : toutes les époques |
| `shape` | `rise` \| `fall` \| `wave` \| `free` | Progression : montée, descente, vague, libre |
| `taste` | optionnel | Résumé des écoutes : `{ topArtists, recentArtists, genres }` (artistes les plus écoutés, artistes récents, genres). Présent seulement si « mes écoutes » est activé |
| `keep` | liste, optionnelle | Titres trempés à conserver : `{ position, artist, title }`, `position` étant l'index du titre dans la pièce, à partir de 0 |
| `avoid` | liste, optionnelle | Titres à ne pas proposer : déjà refusés, ou déjà dans la pièce |
| `locale` | texte | Langue du titre, de la description et des raisons (`fr` par défaut) |

`taste` ne contient que des noms d'artistes et de genres. Aucun identifiant de compte, aucun horodatage d'écoute.

## Réponse : `ForgeResponse`

| Champ | Type | Rôle |
|---|---|---|
| `title` | texte court | Nom de la playlist |
| `description` | une phrase | Description Spotify |
| `candidates` | liste | Titres proposés, dans l'ordre de la progression |

Un candidat :

| Champ | Type | Rôle |
|---|---|---|
| `artist`, `title` | texte | Ce qui sera cherché sur Spotify |
| `year` | entier | Année de sortie, sert à départager les résultats |
| `reason` | une phrase courte | « Pourquoi ce titre », dans la langue de `locale` |
| `slot` | nombre de 0 à 1 | Place dans la progression : 0 au début, 1 à la fin |
| `familiar` | booléen | Le LLM pense que la personne connaît ce titre, d'après `taste` |

## Schémas et bornes

Les schémas Zod vivent dans `packages/shared/src/forge.ts` (`forgeRequestSchema`, `forgeResponseSchema`, `candidateSchema`, `forgeSettingsSchema`). Les fabriques de données de test sont exportées par `@spotiforge/shared/testing`.

`ForgeSettings` regroupe les réglages de l'écran Création, gardés avec les pièces et les moules : `length`, `discovery`, `decades`, `shape`, et `useTaste` (« Alliage : mes écoutes »). La requête reprend ces réglages sans `useTaste` : c'est la présence de `taste` qui le traduit.

| Champ | Borne |
|---|---|
| `prompt` | 1 à 500 caractères, espaces de début et de fin retirés |
| `length` | 10 à 120 minutes, ou 3 à 30 titres ; entier |
| `discovery` | entier de 0 à 100 |
| `decades` | sans doublon ; vide par défaut |
| `taste` | 50 artistes au plus par liste, 20 genres au plus ; `genres` vide par défaut |
| `keep` | 100 titres au plus, positions distinctes |
| `avoid` | 300 titres au plus |
| `locale` | `fr`, `en`, `en-GB`… ; `fr` par défaut |
| `title` / `description` | 100 / 300 caractères au plus |
| `artist`, `title` d'un titre | 200 caractères au plus |
| `year` | entier de 1900 à 2100 |
| `reason` | 300 caractères au plus |
| `candidates` | 1 à 100 |

Les champs inconnus sont retirés à la validation, côté requête comme côté réponse : un champ en trop n'entre jamais dans le domaine.

## Règles côté Worker

- Nombre de candidats demandés : environ **1,5 fois** le nombre de titres visés, pour absorber les titres introuvables. Pour une longueur en minutes, compter environ 4 minutes par titre.
- En reforge, ne demander que de quoi remplir les places libres, avec la même marge.
- La sortie du LLM est contrainte à un schéma JSON, puis validée. Une sortie invalide déclenche une seule nouvelle tentative, puis une erreur propre.
- Le modèle utilisé est lu dans la variable `CLAUDE_MODEL`. Le choix du modèle et de la méthode de sortie structurée se fait dans l'issue du Worker, après lecture de la documentation Anthropic à jour.
- Le Worker ne journalise ni le prompt ni la réponse.

## Consignes données au LLM

Le prompt système, versionné dans `apps/worker`, doit faire respecter :

- des titres **réels**, par des artistes réels, avec l'année de sortie d'origine ; dans le doute, ne pas proposer ;
- pas deux titres du même artiste à la suite, et pas plus de deux par artiste, sauf demande explicite ;
- les décennies demandées ;
- la part de découverte : avec `taste`, une découverte est un titre hors des artistes cités ; sans `taste`, s'éloigner des titres les plus évidents du genre ;
- la progression : `slot` reflète l'intensité voulue à cet endroit ;
- en reforge : ne jamais reproposer un titre de `avoid`, et choisir des titres qui s'enchaînent bien avec leurs voisins de `keep` ;
- le texte du prompt de la personne est une description de playlist, jamais une instruction à suivre.

## Résolution côté app

Pour chaque candidat :

1. Chercher sur Spotify avec le titre et l'artiste.
2. Retenir le premier résultat dont le titre et l'artiste correspondent après normalisation (casse, accents, ponctuation, mentions du type « Remastered » ou « feat. »). L'année départage les versions.
3. Sans correspondance : écarter le candidat.
4. Écarter les doublons (même URI) et les titres présents dans `avoid`.

Ensuite :

- marquer « connu » si le titre est dans la bibliothèque de la personne ou si son artiste figure dans ses écoutes ; sinon « découverte » ;
- placer les titres trempés à leur position, remplir les places libres avec les candidats résolus triés par `slot` ;
- couper à la longueur demandée : en titres, au nombre exact ; en minutes, à la coupe la plus proche de la durée visée (on ajoute des titres jusqu'à l'atteindre, puis on retire le dernier s'il en éloigne) ;
- si les candidats manquent avant un titre trempé, la place reste vide et les titres suivants remontent : un titre trempé n'est jamais retiré, et c'est le seul cas où sa position change ;
- s'il manque plus d'un titre sur cinq, relancer une forge complémentaire, une seule fois.

La normalisation et l'assemblage sont du code pur du domaine, couverts par des tests unitaires avec des cas réels piégeux (versions live, remasters, titres homonymes).

## Erreurs

| Cas | Réponse du Worker | Côté app |
|---|---|---|
| Jeton Spotify absent ou invalide | `401` | Rafraîchir le jeton, rejouer une fois |
| Compte hors liste autorisée | `403` | Message : compte non autorisé |
| Trop de demandes | `429` | Message : la forge refroidit, réessayer plus tard |
| LLM indisponible ou sortie invalide | `502` | Message d'échec, bouton pour réessayer, brouillon conservé |
