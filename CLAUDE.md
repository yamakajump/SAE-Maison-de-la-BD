# SAE BUT 2 - Maison de la BD

Contexte de passation pour Claude Code. À lire en entier avant toute modification.

## Le projet

Application web interne (réseau local) de la Maison de la Bande Dessinée de Blois : archiver, gérer et consulter un fonds de plusieurs milliers d'albums et de revues. Sujet officiel : `sujet/Sujet SAE - Maison de la BD.pdf`.

Exigences du sujet :
- **Public (sans connexion)** : recherche multicritère (titre, auteur, éditeur, année, mots-clés), notice album (co-auteurs, parution, éditeur, ISBN), notice revue (ISSN/ISBN, prix, sommaire détaillé articles et BD).
- **Gestionnaire et Admin** : ajout, modification, suppression des notices ; import automatique par ISBN (Open Library, Google Books) au scan ou à la saisie ; gestion des utilisateurs avec rôles Admin, Gestionnaire, Public.
- **Technique** : client-serveur sur LAN, SGBD local (PostgreSQL retenu), Git avec tickets.
- **Livrables mi-parcours** : dossier d'analyse, UML (cas d'utilisation, classes, séquences), MCD/MLD, maquettes UI/UX.
- **Livrables finaux** : code versionné et documenté (README d'installation), base de test de 50 notices réalistes ou plus, application déployée sur le LAN.

Stack visée pour l'application finale : **Rust (Axum, sqlx, PostgreSQL, Askama, htmx)**.

## Où on en est

Le **prototype** (`prototype/`) est fait. HTML, CSS et JS sans framework, il sert de maquette fonctionnelle et fixe la direction artistique. Toutes les données vivent dans le navigateur (localStorage), il n'y a pas de serveur.

Écrans en place :
- accueil avec recherche, suggestions dès la première lettre (tolère les fautes : « tor gal » trouve Thorgal), raccourcis, chiffres du fonds, ajouts récents, thèmes, séries ;
- résultats avec panneau « Affiner » (thème, période, éditeur, état) et tri (série, titre, parution récente ou ancienne, ajout) ;
- notice album et notice revue (sommaire), avec la couverture floutée en fond ;
- connexion simulée (choix d'un profil), scan en file à la douchette (doublons détectés, pré-remplissage Open Library), file « À compléter », création de revue, page Équipe (comptes et rôles) ;
- thème clair et sombre, bouton dans l'en-tête.

Les personas qui jugent chaque écran sont dans `design/personas.md` (Martine la documentaliste à la douchette, Odile la lectrice, Inès la collégienne, etc.). La direction artistique est dans `design/directions-artistiques.md`.

## Lancer et vérifier

```bash
python -m http.server 8765 --directory prototype
```

Puis ouvrir http://localhost:8765. Dans l'app Claude desktop, `.claude/launch.json` déclare ce serveur (configuration `prototype`).

Captures de tous les écrans en 1366 x 768 (l'écran de Martine), avec relevé des erreurs JS :

```bash
pip install playwright
python .claude/capturer.py
```

Le script utilise le Chrome installé (`channel="chrome"`) et écrit dans `.claude/captures/` (ignoré par git). Il attend le serveur sur le port 8765.

## Carte du code

- `prototype/index.html` : polices (Bricolage Grotesque, Figtree), icônes Phosphor par CDN, script qui pose le thème sur `html[data-theme]` avant l'affichage.
- `prototype/data.js` : jeu de démonstration (`SEED_NOTICES`, comptes). Albums réels issus d'Open Library, revues fictives.
- `prototype/app.js` : routeur par hash (`router()`), état dans localStorage sous la clé `mbd-proto-v5` (`seedState()` pour repartir de zéro), un `render*` par écran. Helpers : `I(nom)` pour une icône Phosphor, `art(nom)` pour une illustration de `assets/`.
- `prototype/styles.css` : tokens en tête (`:root` et `[data-theme="dark"]`), puis les blocs par thème visuel, commentés.
- `prototype/assets/` : logo vectoriel (`logo.svg`, sert aussi de favicon), illustrations de thèmes (`theme-*.webp`), états vides (`vide-*`, `tout-complet`, `acces-equipe`, `page-perdue`), icônes illustrées (`ic-*.webp`).
- `outils/fetch_notices.py` : récupère des notices réelles sur Open Library à partir d'une liste d'ISBN.

## Prochaines étapes

1. **Base de test de 50 notices réelles ou plus** (livrable obligatoire) : étendre la liste d'ISBN de `outils/fetch_notices.py`, normaliser titres, séries et rôles comme dans `data.js`, vérifier chaque éditeur.
2. **UML et MCD/MLD** (mi-parcours) : cas d'utilisation, classes, séquences (scan d'un ISBN, recherche), modèle de données PostgreSQL (notice, album, revue, article du sommaire, auteur avec rôle, éditeur, mot-clé, utilisateur, rôle).
3. **Icônes en local** : Phosphor est chargé par CDN, à copier dans le projet pour un réseau local sans internet.
4. **Application Rust** : reprendre écran par écran le prototype, avec la même DA.

## Règles du projet

- **Tout en français** : interface, commentaires, commits, docs. Le code (variables, fonctions) en anglais.
- **Jamais de tiret cadratin** (le tiret long, U+2014) nulle part. Utiliser un tiret court, une virgule ou deux-points. Vérifier en fin de chantier avec `LC_ALL=C.UTF-8 grep -rnP "\x{2014}" .`.
- **Vocabulaire du public** : « album », « code-barres », « où le trouver ». Jamais « notice » ni « ISSN » côté public.
- **DA** : partir des tokens existants, ne jamais réintroduire de couleur ou de police hors palette, une seule couleur d'action (braise). Aucun rendu par défaut de bibliothèque.
- **Vérifier visuellement** : tout changement visible se valide en relançant `capturer.py` et en regardant les captures, en clair et en sombre, avant de le présenter.
- **Commits conventionnels en français** : `feat(recherche): ajoute le tri par éditeur`. Une branche par chantier, PR en squash.

Directions déjà rejetées, à ne pas reproposer : thème BD criard, bleu encre et Inter façon outil par défaut, style « premium » de site vitrine, tableau dense façon Linear, Lexend avec tuiles pastel en éventail, reprise de la charte d'une librairie.
