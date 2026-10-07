// Usage: node tools/build-domireversi.js   (depuis le dossier du site, après build-spells.js)
// Classe les monstres par intérêt pour le sort de Songe « Domi Reversi » (change le camp de l'ennemi visé
// et de ses invocations jusqu'au tour suivant): un monstre qui tape fort et en zone fait plus de dégâts
// à ses anciens alliés. Estimation avec les dégâts du niveau 225, avant résistances.
const fs = require("fs");
const path = require("path");
const G = require("../assets/js/simulator/grid.js");

const ROOT = path.join(__dirname, "..");
const spells = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "spells.json"), "utf8"));
const yaml = fs.readFileSync(path.join(ROOT, "data", "monsters.yaml"), "utf8");

const monsters = new Map();
for (const block of yaml.split(/\n(?=- Id:)/)) {
  const id = Number((block.match(/^﻿?- Id: (\d+)/) || [])[1]);
  if (!id) {
    continue;
  }
  monsters.set(id, {
    name: (block.match(/^  Name: (.*)$/m) || [])[1],
    image: (block.match(/^  Image: (.*)$/m) || [])[1] || "",
    event: (block.match(/^  Event: (.*)$/m) || [])[1] || "",
  });
}

const center = { u: 17, v: -3 };
const caster = { u: 13, v: -3 };
const areaOf = (zone) => Math.min(G.zoneCells(center, caster, zone).length, 60);

function damageOf(spell) {
  return (spell.effects || [])
    .filter((e) => (e.kind === "damage" || e.kind === "steal") && e.est && e.target !== "les alliés du lanceur")
    .reduce((sum, e) => sum + (e.est[0] + e.est[1]) / 2, 0);
}

const rows = [];
for (const [idText, data] of Object.entries(spells)) {
  const id = Number(idText);
  const info = monsters.get(id);
  // Les monstres de niveau très supérieur à 225 (ex: Cire Momore, niveau 900) ne montent pas en Songes: estimation non fiable.
  if (!info || id >= 3000000 || (data.stats && data.stats.level > 300)) {
    continue;
  }
  const options = data.spells
    .map((spell) => ({ spell, damage: damageOf(spell), area: areaOf(spell.zone) }))
    .filter((o) => o.damage > 0 && o.spell.pa > 0);
  if (!options.length) {
    continue;
  }

  // Tour type: on dépense les PA sur les sorts les plus rentables par PA (dégâts × racine de la zone).
  let pa = data.pa || 0;
  const plan = [];
  let burst = 0;
  const ranked = [...options].sort((a, b) => (b.damage * Math.sqrt(b.area)) / b.spell.pa - (a.damage * Math.sqrt(a.area)) / a.spell.pa);
  for (const option of ranked) {
    const limit = option.spell.cooldown > 0 ? 1 : (option.spell.maxPerTurn || Math.floor(pa / option.spell.pa));
    let casts = 0;
    while (casts < limit && pa >= option.spell.pa) {
      pa -= option.spell.pa;
      burst += option.damage;
      casts += 1;
    }
    if (casts) {
      plan.push({ name: option.spell.name, casts, damage: Math.round(option.damage), area: option.area });
    }
  }

  const best = options.sort((a, b) => b.damage * Math.sqrt(b.area) - a.damage * Math.sqrt(a.area))[0];
  const hasSummon = data.spells.some((spell) => /invoque/i.test(spell.desc || ""));
  rows.push({
    id,
    name: info.name,
    image: info.image,
    event: info.event,
    pa: data.pa,
    burst: Math.round(burst),
    score: Math.round(burst * Math.sqrt(Math.max(1, ...plan.map((p) => p.area)))),
    bestSpell: { name: best.spell.name, damage: Math.round(best.damage), area: best.area, po: [best.spell.poMin, best.spell.poMax] },
    plan,
    summons: hasSummon,
  });
}

rows.sort((a, b) => b.score - a.score);
const top = rows.slice(0, 12);
fs.writeFileSync(path.join(ROOT, "data", "domireversi.json"), JSON.stringify(top));
console.log(`${rows.length} monstres évalués, top ${top.length} écrit dans data/domireversi.json`);
top.forEach((r, i) => console.log(`${i + 1}. ${r.name}: tour ≈ ${r.burst} (score ${r.score}), meilleur sort ${r.bestSpell.name} ≈ ${r.bestSpell.damage} sur ${r.bestSpell.area} case(s)`));
