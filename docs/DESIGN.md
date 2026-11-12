# Design : direction « Braise »

Maquettes et tokens dans [`design/`](../design/). Ce document dit ce qu'ils signifient.

## L'idée

Une playlist se forge. Tant qu'un titre est **à chaud**, il rougeoie et peut encore être remplacé. Quand on le **trempe**, il refroidit, vire à l'acier et ne bouge plus.

Cette opposition chaud / froid porte toute l'interface : l'état d'un titre se lit à sa couleur, sans légende.

## Principes

1. **Noir chaud et métal incandescent.** Le fond est presque noir. La lumière vient du feu : orange, jaune, blanc chaud.
2. **Le chaud est malléable, le froid est définitif.** Orange et jaune pour ce qui peut changer ou déclenche une action. Acier bleuté pour ce qui est fixé.
3. **Typographie d'atelier.** Titres en capitales étroites et grasses, très grandes. Texte courant sobre et lisible.
4. **Angles vifs.** Aucun arrondi. Bordures d'un pixel.
5. **La lueur se mérite.** Halo réservé à ce qui est chaud : bouton principal, barres de réglage, titres à chaud. Rien d'autre ne brille.
6. **Calme malgré le feu.** Peu d'éléments par écran, pas d'animation gratuite.

## Couleurs

Valeurs dans [`design/tokens.json`](../design/tokens.json). Usage :

| Token | Usage |
|---|---|
| `bg` | Fond de tous les écrans |
| `ember` | Action principale, sélection, bordure d'un élément actif |
| `flame` | Numéros et libellés d'un titre à chaud, sélection douce |
| `steel` | Tout ce qui est trempé |
| `text`, `textSoft`, `textMuted` | Texte, du plus au moins important |
| `surfaceHot` / `surfaceCold` | Fond d'un titre selon son état |

Règles :

- `ember` et `steel` ne se mélangent pas sur un même élément.
- Texte posé sur `ember` ou `steel` : toujours `onEmber`.
- Tout texte garde un contraste d'au moins 4,5:1 avec son fond (3:1 à partir de 24 px).
- Le dégradé `heading` ne sert qu'aux grands titres d'écran.

## Typographie

- **Big Shoulders Display** (700, 900) : titres, valeurs, boutons, numéros. Toujours en capitales pour les titres et les boutons.
- **Barlow** (400, 500, 600) : texte courant, libellés, métadonnées.

Les styles nommés (`hero`, `title`, `cta`, `label`…) sont dans les tokens. Pas de taille de texte hors de cette échelle.

Les deux polices sont embarquées dans l'app. Pas de chargement réseau.

## Composants

| Composant | Rôle | Détails |
|---|---|---|
| `Wordmark` | « SPOTIFORGE » avec son point de braise | En-tête des écrans principaux |
| `HeroTitle` | Grand titre en dégradé | Un seul par écran |
| `OreField` | Zone de saisie du prompt | Libellé « Le minerai — ton moment » |
| `HeatBar` | Curseur en barre chauffée | Rempli par le dégradé `heatBar`, halo, zone tactile de 44 px de haut |
| `Chip` | Choix multiple (époques) | Sélectionné : fond `ember` |
| `SegmentButton` | Choix unique (progression) | Sélectionné : bordure et texte `flame` |
| `AlloySwitch` | Interrupteur « mes écoutes » | Carré, pas de pastille ronde |
| `TrackRow` | Un titre dans l'aperçu | Deux états : à chaud, trempé |
| `QuenchButton` | Tremper / Trempé | À chaud : contour `ember`. Trempé : plein `steel` |
| `PrimaryButton` | Action principale | Fond `ember`, halo `cta` |
| `SecondaryButton` | Action secondaire (Reforger) | Contour `ember`, texte `flame` |

`TrackRow` à chaud : fond `surfaceHot`, bordure `borderHot`, lueur intérieure, numéro `flame` lumineux. Trempé : fond `surfaceCold`, bordure `borderCold`, aucune lueur, numéro `steel`.

L'écran « Sur l'enclume » porte en haut la lueur `anvilGlow`, pendant de `forgeGlow` (le foyer en bas de l'écran Création). Le bouton de reforge annonce le nombre de titres à chaud (« Reforger 5 titres ») et devient « Tout est trempé », désactivé, quand il n'y en a plus.

## Mouvement

- **Tremper** : le titre passe du chaud au froid en 300 ms environ, la lueur s'éteint. Retour haptique léger.
- **Reforger** : les titres à chaud s'embrasent brièvement puis sont remplacés. Les titres trempés ne bougent pas.
- **Forge en cours** : la lueur du foyer en bas d'écran pulse. Pas de spinner générique.
- Respecter le réglage système de réduction des animations : dans ce cas, changements d'état instantanés.

## Vocabulaire de l'interface

Le vocabulaire fait partie du design. Un même mot pour une même chose, partout.

| Concept | Mot dans l'interface | À ne pas écrire |
|---|---|---|
| Générer la playlist | **Forger** | Générer, créer |
| Le prompt | **Le minerai** | Prompt, requête |
| Écran d'aperçu | **Sur l'enclume** | Aperçu, preview |
| Titre non verrouillé | **À chaud** | Déverrouillé, libre |
| Verrouiller un titre | **Tremper** | Verrouiller, lock |
| Titre verrouillé | **Trempé** | Verrouillé |
| Déverrouiller | **Remettre au feu** | Déverrouiller |
| Régénérer les titres à chaud | **Reforger** | Régénérer, relancer |
| Historique | **Mes pièces** | Historique, bibliothèque |
| Une playlist forgée | **Une pièce** | Item, entrée |
| Modèle réutilisable | **Un moule** | Template, preset |
| Option « mes écoutes » | **Alliage : mes écoutes** | Personnalisation |
| Dosage découverte | **Température de découverte** | Dosage |
| Durée | **Longueur de la barre** | Durée de la playlist |

Deux exceptions où la clarté prime sur la métaphore :

- les actions qui touchent au compte disent ce qu'elles font : « Se connecter avec Spotify », « Envoyer sur Spotify », « Se déconnecter » ;
- les messages d'erreur disent d'abord ce qui se passe et quoi faire, en mots simples. La métaphore peut colorer la phrase, jamais la remplacer.

Dans le code, les identifiants restent en anglais : `quench` (tremper), `reforge`, `piece`, `mold` (moule), `ore` (minerai).

## Accessibilité

- Zones tactiles d'au moins 44 × 44 px.
- L'état trempé ou à chaud est porté par la couleur **et** par le texte du bouton (« Tremper » / « Trempé »), jamais par la couleur seule.
- Chaque contrôle a un libellé lu par les lecteurs d'écran, en mots simples : « Tremper Nightcall », « Durée en minutes ».
- Les tailles de texte suivent le réglage système dans la limite de ce que la mise en page supporte.

## Rapport à Spotify

Spotiforge n'utilise ni le logo, ni les couleurs, ni la typographie de Spotify. Le nom « Spotify » n'apparaît que dans les actions qui concernent le compte.
