# Direction artistique - Maison de la BD

Sobre et chaleureuse, pensée pour un usage quotidien. Les couvertures apportent la couleur, l'interface reste calme. Thème clair et thème sombre, bouton dans l'en-tête.

Référence vivante : les tokens en tête de `prototype/styles.css`. Ce document en donne l'esprit.

## Couleurs (thème clair)

| Rôle | Token | Valeur |
|---|---|---|
| Fond de page (lin) | `--paper` | #FAF5EE |
| Fond secondaire | `--paper-2` | #F2E6D6 |
| Cartes | `--card` | #FFFDF9 |
| Bordures | `--line` / `--line-strong` | #EADCCB / #D9C3A8 |
| Texte (cacao) | `--ink` / `--ink-2` / `--ink-3` | #33272A / #5A4A46 / #75625D |
| Action unique (braise) | `--red` / `--red-dark` | #C0532F / #A9471F |
| Succès, alerte, info | `--green`, `--amber`, `--blue` | #4E7F5B, #A2700F, #52608A |
| Surlignage de recherche | `--mark` | #F8DC9C |

Le thème sombre (`[data-theme="dark"]`) garde les mêmes rôles en tons chauds : fond #191513, cartes #221C19, braise #DD6B44.

Chaque couleur porte un seul rôle. La braise est réservée aux actions principales, à l'onglet actif et au focus.

## Typographie

- Titres : **Bricolage Grotesque** (600 et 700).
- Texte : **Figtree**, 15 px minimum pour le contenu (Martine lit mal les petits textes gris).
- Codes (ISBN, cotes) : JetBrains Mono.

## Formes et profondeur

- Rayon de 12 px pour les cartes, 10 px pour les boutons.
- Ombres légères et chaudes, plus marquées sous les couvertures.
- Couvertures toujours en ratio 2:3, jamais déformées, qui s'ouvrent légèrement en 3D au survol.
- Pastilles teintées (`.tint`) pour les thèmes et les raccourcis.

## Icônes et illustrations

- Icônes d'interface : Phosphor, style duotone, toujours accompagnées d'un libellé.
- Illustrations maison dans `prototype/assets/` : thèmes, états vides, raccourcis. Même style pour toutes, à garder si on en ajoute.
- Logo (`logo.svg`) : une maison dont le toit est un album ouvert posé à l'envers et la façade une planche de trois cases, avec une bulle dans le pignon. Lisible jusqu'à 16 px.

## Ce qu'on évite

Rendu par défaut de bibliothèque, hero centré avec accroche, halos et dégradés, titres géants serrés, éventails de cartes pastel, clins d'œil « BD » criards dans l'interface.
