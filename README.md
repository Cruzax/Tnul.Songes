# Tnul.Songes

Un site simple pour survivre aux Songes Infinis sans relire tout le wiki.

## Ce que fait le site

- liste les boss des songes et résume leurs mécaniques
- donne des conseils pour ne pas mourir bêtement
- simule un combat sur la grille (portée, ligne de vue, sorts du boss)
- montre les positions de départ des salles de boss (`salles.html`)

## Arborescence

```
index.html, salles.html        pages
assets/
  css/simulator.css            styles du simulateur
  images/
    monsters/                  {Id}_{Nom}.png
    spells/                    icônes de sorts (sort_{id}.png)
    allies/                    pions alliés
    ui/                        icône du site, fond
  js/
    main.js                    point d'entrée de la page d'accueil
    config.js                  chemins et constantes
    data/loaders.js            chargement monstres / sorts / événements
    components/                carrousel, recherche, fiche détail
    lib/                       utilitaires (texte, images)
    simulator/                 grille isométrique + simulateur
    salles.js                  page des salles
data/                          monsters.yaml, spells.json, events.yaml, maps.json, domireversi.json
tools/                         scripts qui génèrent spells.json et domireversi.json
tests/                         tests de la grille
```

## Stack

- UI: Tailwind CSS (CDN)
- Parsing YAML: `js-yaml` (CDN)
- JavaScript vanilla en modules ES, sans étape de build

## Lancer en local

Les modules ES demandent un serveur HTTP (pas d'ouverture directe du fichier) :

```powershell
npx http-server -p 5500
```

Puis ouvre `http://localhost:5500`.

## Tests et données

```powershell
node --test tests/grid.test.js
node tools/build-spells.js        # régénère data/spells.json depuis DofusDB
node tools/build-domireversi.js   # régénère data/domireversi.json
```
