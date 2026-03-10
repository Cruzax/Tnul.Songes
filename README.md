# Structure proposee (site simple)

## Arborescence

- `index.html` : page principale
- `assets/css/styles.css` : style du site
- `assets/js/main.js` : logique front simple
- `assets/images/monsters/` : images des monstres
- `data/monsters.yaml` : base de donnees source

## Lancer en local

Ouvre le dossier dans VS Code, puis lance un serveur local (exemple):

```powershell
python -m http.server 5500
```

Ensuite ouvre `http://localhost:5500`.

## Suite possible

1. Ajouter un parseur YAML en front (ex: `js-yaml`) pour convertir `monsters.yaml` en objets JS.
2. Construire des cartes de monstres avec filtres (difficulte, focus, evasion).
3. Ajouter une page detail par monstre.
