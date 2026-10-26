// Usage: node tools/patch-classes.js [--from ../../dofusclasse]   (depuis le dossier du site)
// Prépare les fiches de classes pour le site: lien « ← Classes » au lieu de « ← Menu », police Inter
// et thème du site (assets/css/fiches.css). Avec --from, recopie d'abord les fiches HTML de dofusclasse
// (out/*.html et le simulateur de portails, jamais les PDF ni les PNG).
// Le script peut tourner plusieurs fois sans rien abîmer.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEST = path.join(ROOT, "classes");
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">';
const THEME = '<link rel="stylesheet" href="../assets/css/fiches.css">';
// Dans la page Classes, la fiche est affichée dans un cadre: on le signale tout de suite à fiches.css
const EMBED = '<script>if (window.top !== window.self) document.documentElement.classList.add("embedded");</script>';
// Bulle des sorts: un clic sur le nom d'un sort ouvre sa carte du grimoire (assets/js/fiches.js)
const POPUP = '<script src="../assets/js/fiches.js" defer></script>';

function copyFrom(source) {
  const out = path.join(source, "out");
  fs.readdirSync(out)
    .filter((name) => name.endsWith(".html"))
    .forEach((name) => fs.copyFileSync(path.join(out, name), path.join(DEST, name)));
  fs.copyFileSync(path.join(source, "simulateurs", "eliotrope-portails.html"), path.join(DEST, "simu-eliotrope-portails.html"));
}

function patch(html) {
  return html
    // Retour vers la page Classes (« target=_top » pour sortir du cadre quand la fiche est intégrée)
    .replace(/href="[^"]*"( target="_top")?>← Menu</g, 'href="../classes.html" target="_top">← Classes<')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Barlow[^>]*>/, FONTS)
    // Ancien correctif des barres de défilement, maintenant dans fiches.css
    .replace(/<style id="tnul-scroll">[\s\S]*?<\/style>/, "")
    .replace(/(<\/style>)(\s*<\/head>)/, (match, style, end) => `${style}\n${THEME}${end}`)
    .replace(`${THEME}\n${EMBED}`, THEME)
    .replace(THEME, `${THEME}\n${EMBED}`)
    .replace(`${EMBED}\n${POPUP}`, EMBED)
    .replace(EMBED, `${EMBED}\n${POPUP}`);
}

const fromIndex = process.argv.indexOf("--from");
if (fromIndex !== -1) {
  copyFrom(path.resolve(process.argv[fromIndex + 1]));
}

fs.readdirSync(DEST)
  .filter((name) => name.endsWith(".html"))
  .forEach((name) => {
    const file = path.join(DEST, name);
    const before = fs.readFileSync(file, "utf8");
    const after = patch(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
    }
    const ok = after.includes(EMBED) && after.includes(POPUP) && after.includes("← Classes") && after.includes("family=Inter");
    console.log(`${ok ? "ok  " : "??? "} ${name}`);
  });
