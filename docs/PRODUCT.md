# Produit

## En une phrase

Spotiforge transforme une description en playlist Spotify, et laisse la personne garder ce qui lui plaît et refaire le reste avant l'envoi.

## Pour qui

Un outil perso pour cinq comptes Spotify au maximum (le propriétaire et quatre proches). Chaque personne se connecte avec son propre compte et crée ses propres playlists. Pas de publication sur les stores, pas de monétisation.

Cette limite vient de Spotify : voir [`SPOTIFY_API.md`](SPOTIFY_API.md).

## Parcours principal

1. **Connexion** avec le compte Spotify.
2. **Création** : un prompt libre (« le minerai ») et des réglages.
3. **Forge** : l'IA compose une liste de titres, l'app vérifie que chacun existe sur Spotify.
4. **Sur l'enclume** (aperçu) : chaque titre est « à chaud » par défaut. La personne trempe ceux qu'elle garde, puis reforge les autres autant de fois qu'elle veut.
5. **Envoi** : la playlist est créée sur le compte Spotify.
6. **Mes pièces** : l'historique local permet de rouvrir une playlist, de la rafraîchir ou de relancer un moule.

## Fonctionnalités de la v1

### Création

- Prompt libre.
- **Longueur** : en minutes ou en nombre de titres, au choix.
- **Température de découverte** : curseur entre titres connus de la personne et découvertes.
- **Époque** : zéro, une ou plusieurs décennies (60s à 20s). Aucune sélection signifie « toutes ».
- **Progression** : montée, descente, vague ou libre. Elle détermine l'ordre des titres.
- **Alliage : mes écoutes** : interrupteur par playlist. Activé, l'IA reçoit un résumé des goûts de la personne (artistes les plus écoutés, écoutes récentes). Désactivé, elle ne se base que sur le prompt.

### Aperçu (sur l'enclume)

- Titre et description de la playlist écrits par l'IA, modifiables.
- Pour chaque titre : nom, artiste, année, mention « connu » ou « découverte », et une ligne « pourquoi ce titre ».
- **Tremper** un titre le verrouille. **Remettre au feu** le déverrouille.
- **Reforger** remplace tous les titres à chaud. Les titres trempés gardent leur position, les nouveaux prennent les places libres, et la progression choisie est respectée.
- Un titre déjà refusé (remplacé lors d'une reforge) n'est pas reproposé pour cette playlist.
- Écouter un titre : ouverture dans l'app Spotify.

### Envoi et suite

- Création de la playlist sur le compte, privée par défaut.
- **Rafraîchir** une playlist déjà envoyée : reforge des titres non trempés, puis mise à jour de la playlist existante sur Spotify (pas de doublon).

### Mes pièces

- Historique des playlists forgées : prompt, réglages, titres, état de trempe, lien Spotify.
- **Moules** : enregistrer un prompt et ses réglages comme modèle réutilisable, pour les relancer en un geste.
- Tout est stocké sur le téléphone. L'historique reste consultable hors ligne.

## Hors périmètre de la v1

Ne pas implémenter sans nouvelle décision produit :

- Publication sur les stores, comptes au-delà de cinq.
- Playlist commune à plusieurs personnes (mode duo).
- Rafraîchissement automatique planifié.
- Synchronisation de l'historique entre appareils.
- Pochette de playlist générée.
- Lecture audio dans l'app, extraits de 30 secondes.
- Autres services de musique que Spotify.
- Choix du fournisseur de LLM dans l'interface.

## Limites connues, assumées

- La progression d'ambiance repose sur la connaissance musicale du LLM. Spotify ne fournit plus l'énergie ni le tempo des titres : l'ordre est plausible, pas mesuré.
- Le LLM peut proposer des titres qui n'existent pas ou qui sont absents du catalogue. Ils sont écartés à la vérification, d'où une génération volontairement excédentaire.
- Si l'abonnement Premium du propriétaire de l'app Spotify s'arrête, l'app cesse de fonctionner pour tout le monde.
