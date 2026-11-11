# Feuille de route

Les milestones se font dans l'ordre. À l'intérieur d'un milestone, l'ordre est donné par les dépendances notées dans chaque issue. Le détail vit dans les issues GitHub : ce fichier donne la carte.

| Milestone | But | À la fin, on peut… |
|---|---|---|
| **M0 · Socle** | Monorepo, outillage, thème Braise, vérification de l'API Spotify | Lancer l'app vide avec le thème, faire tourner lint et tests en CI |
| **M1 · Connexion** | Connexion Spotify et session | Se connecter, voir son compte, se déconnecter |
| **M2 · Forge** | Worker, génération, résolution, écran Création | Écrire un prompt et obtenir une liste de titres réels |
| **M3 · Enclume** | Aperçu, trempe, reforge, envoi | Tremper, reforger et envoyer une playlist sur Spotify |
| **M4 · Mes pièces** | Historique local, moules, rafraîchissement | Retrouver ses pièces, relancer un moule, rafraîchir une playlist |
| **M5 · Finitions** | États limites, accessibilité, distribution | Installer l'app sur les cinq téléphones |

## Epics

| Epic | Milestone |
|---|---|
| #1 · Socle technique | M0 |
| #2 · Design system Braise | M0 |
| #3 · Connexion Spotify | M1 |
| #4 · Worker de forge | M2 |
| #5 · Écran Création et moteur de forge | M2 |
| #6 · Sur l'enclume : aperçu, trempe, reforge | M3 |
| #7 · Envoi sur Spotify | M3 |
| #8 · Mes pièces : historique et moules | M4 |
| #9 · Finitions et distribution | M5 |

## Ce qui débloque quoi

- La **vérification de l'API Spotify** (#13, M0) passe avant tout code qui lit les écoutes : trois endpoints restent à confirmer en mode développement.
- Le **contrat de forge** dans `packages/shared` (#23, M2) passe avant le Worker et avant le client de l'app.
- Les **maquettes des écrans manquants** (#18, M0) passent avant les écrans Connexion et Mes pièces.
- Le **domaine d'assemblage, de trempe et de reforge** (#35) appartient à l'epic de l'enclume mais se fait dès M2 : la première forge en a besoin.

## Après la v1

Idées notées, non planifiées : playlist à deux, rafraîchissement automatique, pochette générée. Voir « Hors périmètre » dans [`PRODUCT.md`](PRODUCT.md).
