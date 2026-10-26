# Tnul.Songes

Un site simple pour survivre aux Songes Infinis sans relire tout le wiki.
En ligne : https://tnulsonges.netlify.app

## Ce que fait le site

- liste les boss des songes (et les 24 avis de recherche qu'on y croise) et résume leurs mécaniques
- donne des conseils pour ne pas mourir bêtement
- simule un combat sur la grille (portée, ligne de vue, sorts du boss)
- montre les positions de départ des salles de boss et le classement Domi Reversi (`salles.html`)
- aide à gagner les combats tactiques de quête (`tactiques.html` + une page par outil)
- regroupe les fiches de classes (`classes.html`) et le générateur de palettes Skinoskope (`palette/`)

## Pages

```
index.html          boss des songes : carrousel, recherche, fiche, simulateur
salles.html         positions de départ des salles + Domi Reversi
tactiques.html      vue d'ensemble des combats tactiques (outils + fiches DPLN)
ambre.html          Ocre d'ambre : aide au marquage des paires
minogolem.html      Dofus Pourpre : solveur du Minogolem
bolgrot.html        Dofus Turquoise : « Extinction des feux »
rainikrone.html     Dofus Ivoire : « Le bonheur est dans le spray »
arakne.html         L'arakne de Leng : les 2 combats en petite arakne, tour par tour
classes.html        fiches des 19 classes : la fiche s'affiche dans une card pleine hauteur (classes.html#cra)
palette/            build de Skinoskope (PaletteDofus)
```

## Arborescence

```
assets/
  css/
    theme.css                  thème commun (menu, en-tête)
    fiches.css                 thème du site appliqué aux fiches de classes (classes/*.html)
    simulator.css              simulateur
    ambre, minogolem, bolgrot, rainikrone, arakne, tactiques, classes .css
  images/
    monsters/                  {Id}_{Nom}.png
    spells/                    icônes de sorts (sort_{id}.png)
    allies/                    pions alliés
    ui/                        logo du site (logo.svg, aussi icône d'onglet), fond
  js/
    tailwind-config.js         config Tailwind partagée par toutes les pages
    main.js                    point d'entrée de la page d'accueil
    config.js                  chemins et constantes
    data/loaders.js            chargement monstres / sorts / événements
    components/                carrousel, recherche, fiche détail
    lib/nav.js                 menu de toutes les pages (liste GROUPS : ajouter une page ici)
    lib/setup.js               bandeau « Mise en place » des combats tactiques (étapes dans data/tactiques.json)
    lib/                       autres utilitaires (fond, icônes, texte, images, stats en songe)
    simulator/                 grille isométrique + simulateur
    salles.js, tactiques.js, classes.js, ambre.js, arakne.js
    minogolem/                 solveur + worker
    bolgrot/                   moteur, recherche, import de capture, worker
    rainikrone/                moteur, recherche, import de capture, worker
classes/                       fiches de classes autonomes (copiées de dofusclasse/out)
palette/                       build Vite de PaletteDofus
data/
  monsters.yaml                fiches des boss (avec BOM)
  spells.json                  sorts et stats des boss (généré)
  events.yaml                  dates des événements saisonniers (estimations)
  maps.json                    salles de boss
  domireversi.json             classement Domi Reversi (généré)
  tactiques.json               liste des combats tactiques
  ambre, minogolem, bolgrot, rainikrone, arakne .json   cartes et règles des combats tactiques
tools/                         scripts qui génèrent spells.json et domireversi.json, et préparent les fiches de classes
tests/                         tests de la grille et des moteurs de combats tactiques
```

## Stack

- UI: Tailwind CSS (CDN)
- Parsing YAML: `js-yaml` (CDN)
- JavaScript vanilla en modules ES, sans étape de build (sauf `palette/`, construit à part)

## Lancer en local

Les modules ES demandent un serveur HTTP (pas d'ouverture directe du fichier) :

```powershell
npx http-server -p 5500
```

Puis ouvre `http://localhost:5500`.
Pour voir les boss d'événement hors saison : `http://localhost:5500/?events=halloween,nowel,chocolat`.

## Tests et données

```powershell
node --test tests/*.test.js       # environ 1 min (les solveurs tournent sur des grilles aléatoires)
node tools/build-spells.js        # régénère data/spells.json depuis DofusDB
node tools/build-domireversi.js   # régénère data/domireversi.json
```

## Fiches de classes et palette

- `classes/` : `node tools/patch-classes.js --from ../../dofusclasse` recopie les fiches HTML de dofusclasse (jamais les PDF ni les PNG), puis les adapte au site : lien « ← Classes », police Inter, thème `assets/css/fiches.css` et bulle des sorts `assets/js/fiches.js` (un clic sur le nom d'un sort ouvre sa carte du grimoire). Sans `--from`, le script repasse juste sur les fiches déjà copiées ; on peut le lancer autant de fois qu'on veut.
- `palette/` : construire PaletteDofus avec `vite build --base ./` en gardant `public/d3` (les fichiers 3D, environ 700 Mo) : l'aperçu 3D doit marcher sur le site. Vérifier en local que la 3D s'affiche avant de pousser.
- Retouches faites directement dans le build de `palette/` (à refaire après un nouveau build, ou à reporter dans les sources de PaletteDofus) : fonds et bordures en gris neutres du site (`#090a0c`, `#111315`, `#16181b`, `#282a2e` au lieu des bruns), halo de l'aperçu 3D neutre, logo remplacé par l'icône du site + « Skino.skope » en Inter, retour au site intégré au logo (« [icône] Tnul.Songes / Skino.skope », icône seule sur mobile) à la place du bouton flottant « ← Tnul.Songes ». Les coiffes qui couvrent le crâne cachent les cheveux (`const HairHats` dans le build, liste recalculée par `python3 tools/palette-coiffes.py`) : la règle est ajoutée dans la fonction de rendu `Ku`, à reporter dans les sources. Même endroit : une cape cache le sac du corps (Enutrof, carquois du Crâ), sauf si un équipement fournit le sien.
