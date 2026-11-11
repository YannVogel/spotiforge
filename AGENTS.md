# AGENTS.md

Règles de travail pour tout agent de code (Claude Code, Codex) et tout humain qui contribue à Spotiforge.

## 1. Principes de code

- **KISS et YAGNI** : c'est une app pour cinq personnes. Pas d'abstraction pour un besoin futur, pas de configuration pour un cas qui n'existe pas.
- **DRY** : une règle métier vit à un seul endroit. Les types et schémas partagés entre l'app et le Worker vivent dans `packages/shared`.
- **SOLID**, surtout la responsabilité unique : un module fait une chose.
- **Dépendances à sens unique**, toutes tournées vers le domaine : `features → domain ← infra`, et `features → ui`. Le domaine ne dépend ni de React, ni d'Expo, ni du réseau, ni de l'infra.
- **Pas de code spaghetti** : pas de logique métier dans les composants, pas d'appel réseau dans un composant d'affichage.
- TypeScript en mode `strict`. Pas de `any`, pas de `@ts-ignore` sans commentaire qui explique pourquoi.
- Les données qui franchissent une frontière (réponse Spotify, réponse du Worker, sortie du LLM, lecture SQLite) sont validées par un schéma avant d'entrer dans le domaine.

## 2. Tests

- Les tests s'écrivent avec le code. Une PR sans tests pour ce qu'elle ajoute est incomplète.
- **Domaine** (`domain/`) : tests unitaires systématiques. C'est là que vit la logique : trempe, reforge, résolution des titres, calcul de durée.
- **Infra** : les clients Spotify et Worker sont testés avec des réponses simulées. Aucun test n'appelle le vrai Spotify ni le vrai LLM.
- **Interface** : tests de composants sur les comportements (appuyer sur « Tremper » change l'état), pas sur les pixels.
- Un bug corrigé arrive avec le test qui l'aurait attrapé.
- Les tests doivent passer en local et en CI avant toute demande de revue.

## 3. Workflow par issue

1. Prends une issue dont les dépendances sont fermées. L'ordre des milestones est dans `docs/ROADMAP.md`.
2. Crée une branche `feat/<numéro>-<slug>`, `fix/<numéro>-<slug>` ou `chore/<numéro>-<slug>`.
3. Lis l'issue, son epic et les docs citées.
4. Code et teste dans le périmètre de l'issue.
5. Lance lint, typecheck et tests.
6. Ouvre une PR qui référence l'issue (`Closes #<numéro>`), décrit ce qui a été fait et comment ça a été vérifié.
7. Si tu découvres un problème hors périmètre, ouvre une issue. Ne l'embarque pas dans la PR.

Si une issue contredit une doc, arrête-toi et signale-le dans l'issue. Ne tranche pas seul.

## 4. Commits et PR

- Commits conventionnels, sujet en français : `feat(forge): tremper un titre dans l'aperçu`.
- Types : `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
- Une PR par issue, la plus petite possible.

## 5. Documentation

- Toute modification structurante met à jour la doc concernée dans la même PR : nouveau module, nouveau flux, nouvel endpoint Spotify, changement du contrat de génération, nouveau token de design.
- Les fichiers `.md` à la racine et dans `docs/` font foi. Si le code et la doc divergent, c'est un bug.
- La section « Commandes » de `CLAUDE.md` reste à jour.

## 6. Langue

- Prose en français partout : docs, issues, PR, commentaires de code, messages de commit, textes de l'interface.
- Code, identifiants, noms de fichiers, logs et messages d'erreur techniques en anglais.
- Les textes de l'interface suivent le vocabulaire de `docs/DESIGN.md` (forger, tremper, reforger…).

## 7. Sécurité et données

- Le repo est public. N'y écris jamais : clé API, jeton, identifiant de compte Spotify, adresse e-mail, donnée d'écoute réelle.
- Les secrets du Worker passent par les secrets Cloudflare. Les valeurs locales vivent dans des fichiers ignorés par git (`.dev.vars`, `.env.local`), avec un fichier `.example` versionné.
- Les jetons Spotify sont stockés sur le téléphone dans le stockage sécurisé du système, jamais dans SQLite ni dans les logs.
- Le Worker ne stocke rien. Il ne journalise ni les prompts, ni les jetons.
- Les jeux de données de test sont inventés ou anonymisés.

## 8. Ce qu'il ne faut pas faire

- Appeler un endpoint Spotify absent de `docs/SPOTIFY_API.md` sans l'avoir vérifié et documenté.
- Mettre la clé Anthropic dans l'app, même « temporairement ».
- Ajouter une dépendance pour ce que vingt lignes font bien.
- Ajouter une fonctionnalité listée « hors périmètre » dans `docs/PRODUCT.md`.
- Introduire une couleur, une police ou un rayon d'arrondi absents de `design/tokens.json`.
- Utiliser le logo ou la charte de Spotify. Le lien avec Spotify se limite au bouton de connexion et à la mention « Envoyer sur Spotify ».
