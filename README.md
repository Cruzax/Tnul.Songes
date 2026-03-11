# Tnul.Songes

Un site simple pour survivre aux Songes Infinis sans relire tout le wiki.

## Ce que fait le site

- liste les monstres des songes
- resume leurs mecaniques
- montre ce qu'ils font vraiment
- donne des conseils pour eviter de mourir betement

## Arborescence

- `index.html` : page principale
- `assets/js/main.js` : logique front
- `assets/images/monsters/` : images des monstres
- `data/monsters.yaml` : base de donnees source

## Stack actuelle

- UI: Tailwind CSS (CDN)
- Parsing YAML: `js-yaml` (CDN)
- Rendu dynamique: JavaScript vanilla (`assets/js/main.js`)

## Lancer en local

```powershell
python -m http.server 5500
```

Ensuite ouvre `http://localhost:5500`.
