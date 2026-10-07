// Usage: node tools/build-spells.js   (depuis le dossier du site, Node 18+)
// Lit data/monsters.yaml (Ids seulement) et écrit data/spells.json depuis DofusDB (valeurs)
// et Dofensive (libellés des cibles, déclencheurs et conditions). Télécharge aussi les icônes des sorts.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SONGE_LEVEL = 225; // palier de référence (Paradoxe I, palier II)
const SHAPES = {
  P: "point", C: "circle", O: "circle", X: "cross", Q: "cross",
  "+": "diagonalCross", "#": "diagonalCross", L: "line", "/": "line",
  T: "perpendicular", V: "cone", G: "square", W: "square", a: "all", A: "all",
};
// Fiches dont l'Id du site diffère de celui de la version « avis de recherche » de DofusDB.
const ALT_IDS = { 1309: 2901, 2053: 3400, 2057: 3403, 2058: 3402, 2181: 3524 };
// Effets de dégâts / vol de vie / soin de DofusDB: [genre, élément, caractéristique utilisée]
const DAMAGE_EFFECTS = {
  96: ["damage", "Eau", "chance"], 97: ["damage", "Terre", "strength"], 98: ["damage", "Air", "agility"],
  99: ["damage", "Feu", "intelligence"], 100: ["damage", "Neutre", "strength"],
  91: ["steal", "Eau", "chance"], 92: ["steal", "Terre", "strength"], 93: ["steal", "Air", "agility"],
  94: ["steal", "Feu", "intelligence"], 95: ["steal", "Neutre", "strength"],
  108: ["heal", "", "intelligence"],
};
// Identifiants de caractéristiques dans `characRatios` de DofusDB
const RATIO_IDS = { life: 0, strength: 10, intelligence: 12, chance: 13, agility: 14, power: 25 };

async function getJson(url, headers) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // on réessaie
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

const dofensiveHeaders = { "User-Agent": "Mozilla/5.0" };

// Les masques et déclencheurs contiennent des #1 à remplacer par leurs paramètres (« l'état #1 » → « l'état Porteur »)
const maskText = (mask) => cleanBraces(String(mask.Name || "").replace(/#(\d)/g, (match, index) => {
  const parameter = (mask.Parameters || [])[Number(index) - 1];
  return parameter ? parameter.Name : "";
}));

// Noms des états et des sorts cités par un effet (DofusDB), avec cache
const nameCache = new Map();
async function lookupName(kind, id) {
  const key = `${kind}:${id}`;
  if (!nameCache.has(key)) {
    const route = kind === "state" ? "spell-states" : "spells";
    const data = await getJson(`https://api.dofusdb.fr/${route}/${id}`);
    const raw = (data && data.name && data.name.fr) || "";
    nameCache.set(key, raw.replace(/^\[!\]\s*/, "").trim());
  }
  return nameCache.get(key);
}
const cleanBraces = (text) => String(text || "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();

function monsterIds() {
  const text = fs.readFileSync(path.join(ROOT, "data", "monsters.yaml"), "utf8");
  // Le fichier commence par un BOM: sans le prévoir, la toute première fiche était ignorée
  return [...text.matchAll(/^﻿?- Id: (\d+)/gm)].map((m) => Number(m[1]));
}

function pickZone(effects) {
  const zones = effects
    .map((effect) => effect.zoneDescr)
    .filter(Boolean)
    .map((z) => {
      const shape = SHAPES[String.fromCharCode(z.shape)];
      return {
        shape: shape || "point",
        size1: z.param1 || 0,
        size2: z.param2 || 0,
        unsupported: !shape,
        isPoint: !shape || shape === "point",
      };
    });
  const withArea = zones.filter((z) => !z.isPoint);
  const chosen = withArea.sort((a, b) => b.size1 - a.size1)[0]
    || zones[0]
    || { shape: "point", size1: 0, size2: 0 };
  const { shape, size1, size2, unsupported } = chosen;
  return unsupported ? { shape, size1, size2, unsupported: true } : { shape, size1, size2 };
}

// Caractéristiques du monstre au palier de référence (formules du mode « Songes » de Dofensive).
function songeStats(monster) {
  const ratios = Object.fromEntries((monster.characRatios || []).map(([id, value]) => [id, value]));
  const level = Math.max(SONGE_LEVEL, ...monster.grades.map((g) => g.level || 0));
  const stat = (id) => Math.floor((ratios[id] || 0) * Math.pow(level, 1.26) + 7);
  // PV: ratio × niveau^1,625, arrondi à 2 chiffres significatifs (même formule que Dofensive)
  const life = Math.max(1, Number(Math.floor((ratios[RATIO_IDS.life] || 0) * Math.pow(level, 1.625)).toPrecision(2)));
  return {
    level,
    life,
    strength: stat(RATIO_IDS.strength),
    intelligence: stat(RATIO_IDS.intelligence),
    chance: stat(RATIO_IDS.chance),
    agility: stat(RATIO_IDS.agility),
    power: stat(RATIO_IDS.power),
  };
}

const effectTemplates = new Map();

async function effectTemplate(effectId) {
  if (!effectTemplates.has(effectId)) {
    const data = await getJson(`https://api.dofusdb.fr/effects/${effectId}`);
    effectTemplates.set(effectId, (data && data.description && data.description.fr) || "");
  }
  return effectTemplates.get(effectId);
}

async function effectText(effect) {
  const template = await effectTemplate(effect.effectId);
  if (!template) {
    return "";
  }
  const n1 = effect.diceNum || 0;
  const n2 = effect.diceSide || 0;
  const n3 = effect.value || 0;
  const hasRange = n2 && n2 !== n1;
  // « État #3 » → nom de l'état ; un effet réduit à « #1 » est un sort déclenché (n1 = id du sort)
  if (template.trim() === "État #3" && n3) {
    const name = await lookupName("state", n3);
    if (name) {
      return `État: ${name}`;
    }
  }
  if (template.trim() === "#1" && n1 > 0) {
    const name = await lookupName("spell", n1);
    if (name) {
      return `Lance « ${name} »`;
    }
  }
  return template
    .replace(/#1\{\{~1~2([^}]*)\}\}#2/g, (match, sep) => (hasRange ? `${n1}${sep}${n2}` : String(n1 || n2)))
    .replace(/\{\{~ps\}\}/g, Math.max(n1, n2, n3) > 1 ? "s" : "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/#1/g, n1 || "")
    .replace(/#2/g, n2 || "")
    .replace(/#3/g, n3 || "")
    .replace(/[{}~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Résumé court des effets immédiats (sans les chiffres de dégâts, qui changent avec le niveau).
async function describeEffects(effects) {
  const parts = [];
  for (const effect of effects) {
    if (effect.triggers && effect.triggers !== "I") {
      continue;
    }
    let text = await effectText(effect);
    if (!text || /^\d+$|exécuté|effet \d+|^état|glyphe|apparence|tue la cible|enlève l'état/i.test(text)) {
      continue;
    }
    if (/^invoque/i.test(text)) {
      text = "Invoque une créature";
    } else if (/vol (Terre|Feu|Eau|Air|Neutre)/i.test(text)) {
      text = "Vol de vie " + text.match(/vol (Terre|Feu|Eau|Air|Neutre)/i)[1];
    } else if (/dommages? (Terre|Feu|Eau|Air|Neutre)/i.test(text)) {
      text = "Dommages " + text.match(/dommages? (Terre|Feu|Eau|Air|Neutre)/i)[1];
    } else if (/soins?/i.test(text)) {
      text = "Soin";
    } else if (effect.duration > 0) {
      text += ` (${effect.duration} t)`;
    }
    text = text.charAt(0).toUpperCase() + text.slice(1);
    if (!parts.includes(text)) {
      parts.push(text);
    }
  }
  return parts.slice(0, 4).join(" · ");
}

// Effets complets d'un sort, avec cible/déclencheur (Dofensive) quand les deux listes correspondent.
async function describeFull(effects, dofensiveEffects, stats) {
  const aligned = dofensiveEffects
    && dofensiveEffects.length === effects.length
    && dofensiveEffects.every((e, i) => e.Id === effects[i].effectId);
  const out = [];
  for (let i = 0; i < effects.length; i += 1) {
    const effect = effects[i];
    const text = await effectText(effect);
    if (!text) {
      continue;
    }
    const entry = { text };
    const damageInfo = DAMAGE_EFFECTS[effect.effectId];
    if (damageInfo) {
      const [kind, element, statName] = damageInfo;
      const stat = stats[statName] || 0;
      const low = effect.diceNum || 0;
      const high = effect.diceSide && effect.diceSide > low ? effect.diceSide : low;
      entry.kind = kind;
      entry.element = element;
      entry.min = low;
      entry.max = high;
      entry.est = [Math.floor((low * (100 + stat)) / 100), Math.floor((high * (100 + stat)) / 100)];
    }
    if (effect.duration > 0) {
      entry.duration = effect.duration;
    }
    if (aligned) {
      const d = dofensiveEffects[i];
      const target = (d.InclusionMasks || []).map(maskText).filter(Boolean).join(" / ");
      const excluded = (d.ExclusionMasks || []).map(maskText).filter(Boolean).join(" / ");
      const when = [...(d.TargetTriggers || []), ...(d.CasterTriggers || []), ...(d.SpecialTriggers || [])]
        .map(maskText)
        .filter((name) => name && !/imm[ée]diatement/i.test(name))
        .join(" / ");
      if (target) {
        entry.target = target;
      }
      if (excluded) {
        entry.except = excluded;
      }
      if (when) {
        entry.when = when;
      }
    }
    out.push(entry);
  }
  return out;
}

function conditionsFrom(dofensiveLevel) {
  const groups = (dofensiveLevel && dofensiveLevel.StateCriteria) || [];
  return groups
    .map((group) => group
      .map((c) => cleanBraces(String(c.Name || "").replace("#1", (c.Parameters || []).map((p) => p.Name).join(", "))))
      .filter(Boolean)
      .join(" et "))
    .filter(Boolean);
}

// Niveau du sort utilisé par le dernier grade du monstre: "grade,niveau;grade,niveau;..." (1er nombre = grade du sort).
function spellGradeFor(monster, index) {
  const raw = Array.isArray(monster.spellGrades) ? monster.spellGrades[index] : null;
  const last = raw ? String(raw).split(";").pop() : "";
  const grade = parseInt(last.split(",")[0], 10);
  return Number.isInteger(grade) && grade > 0 ? grade : 1;
}

async function buildSpell(spellId, grade, stats) {
  const spell = await getJson(`https://api.dofusdb.fr/spells/${spellId}`);
  if (!spell || !spell.spellLevels || !spell.spellLevels.length) {
    return null;
  }
  const levelId = spell.spellLevels[Math.min(grade, spell.spellLevels.length) - 1];
  const level = await getJson(`https://api.dofusdb.fr/spell-levels/${levelId}`);
  if (!level || !level.apCost) {
    return null;
  }

  const dofensive = await getJson(`https://dofensive.com/api/dofus2/bestiary/spells/${spellId}?lang=fr`, dofensiveHeaders);
  const dofensiveLevels = (dofensive && dofensive.Data && dofensive.Data[0] && dofensive.Data[0].Levels) || [];
  const dofLevel = dofensiveLevels.find((l) => l.Grade === grade) || dofensiveLevels[dofensiveLevels.length - 1];
  const flat = (groups) => (groups || []).flatMap((g) => g.Effects || []);

  return {
    id: spellId,
    name: (spell.name && spell.name.fr) || String(spellId),
    pa: level.apCost,
    poMin: level.minRange,
    poMax: level.range,
    poModifiable: Boolean(level.rangeCanBeBoosted),
    line: Boolean(level.castInLine),
    diagonal: Boolean(level.castInDiagonal),
    los: Boolean(level.castTestLos),
    cooldown: level.minCastInterval || 0,
    initialCooldown: level.initialCooldown || 0,
    maxPerTurn: level.maxCastPerTurn || 0,
    maxPerTarget: level.maxCastPerTarget || 0,
    critical: level.criticalHitProbability || 0,
    conditions: conditionsFrom(dofLevel),
    zone: pickZone(level.effects || []),
    desc: await describeEffects(level.effects || []),
    icon: spell.iconId > 0 ? spell.iconId : 0,
    effects: await describeFull(level.effects || [], flat(dofLevel && dofLevel.GroupEffects), stats),
    critEffects: await describeFull(level.criticalEffect || [], flat(dofLevel && dofLevel.GroupCriticalEffects), stats),
  };
}

async function buildMonster(id) {
  const monster = (await getJson(`https://api.dofusdb.fr/monsters/${id}`))
    || (ALT_IDS[id] ? await getJson(`https://api.dofusdb.fr/monsters/${ALT_IDS[id]}`) : null);
  if (!monster || !monster.grades || !monster.grades.length) {
    return null;
  }
  const grade = monster.grades[monster.grades.length - 1];
  const stats = songeStats(monster);
  const spells = [];
  const spellIds = monster.spells || [];
  for (let i = 0; i < spellIds.length; i += 1) {
    const built = await buildSpell(spellIds[i], spellGradeFor(monster, i), stats);
    if (built) {
      spells.push(built);
    }
  }
  return { pa: grade.actionPoints, pm: grade.movementPoints, stats, spells };
}

async function downloadIcons(iconIds) {
  const dir = path.join(ROOT, "assets", "images", "spells");
  fs.mkdirSync(dir, { recursive: true });
  const queue = [...iconIds].filter((id) => !fs.existsSync(path.join(dir, `sort_${id}.png`)));
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const response = await fetch(`https://api.dofusdb.fr/img/spells/sort_${id}.png`);
        if (response.ok) {
          fs.writeFileSync(path.join(dir, `sort_${id}.png`), Buffer.from(await response.arrayBuffer()));
          done += 1;
        }
      } catch (error) {
        console.warn(`Icône ${id} non téléchargée`);
      }
    }
  }));
  console.log(`${done} nouvelles icônes téléchargées dans assets/images/spells`);
}

// node tools/build-spells.js --missing: ajoute seulement les monstres qui manquent à data/spells.json
// node tools/build-spells.js --life-only: ajoute seulement les PV à data/spells.json existant
async function patchLife() {
  const file = path.join(ROOT, "data", "spells.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const queue = Object.keys(data);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const monster = (await getJson(`https://api.dofusdb.fr/monsters/${id}`))
        || (ALT_IDS[id] ? await getJson(`https://api.dofusdb.fr/monsters/${ALT_IDS[id]}`) : null);
      if (monster && monster.grades && monster.grades.length) {
        const { level, ...rest } = data[id].stats;
        data[id].stats = { level, life: songeStats(monster).life, ...rest };
      } else {
        console.warn(`Pas de PV pour l'Id ${id}`);
      }
    }
  }));
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`PV ajoutés à ${Object.keys(data).length} monstres`);
}

async function main() {
  if (process.argv.includes("--life-only")) {
    return patchLife();
  }
  // --missing: ne construit que les monstres absents de data/spells.json et garde les autres tels quels
  const missingOnly = process.argv.includes("--missing");
  const out = missingOnly ? JSON.parse(fs.readFileSync(path.join(ROOT, "data", "spells.json"), "utf8")) : {};
  const queue = monsterIds().filter((id) => !missingOnly || !out[id]);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const built = await buildMonster(id);
      if (built) {
        out[id] = built;
      } else {
        console.warn(`Pas de données pour l'Id ${id}`);
      }
    }
  }));
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(path.join(ROOT, "data", "spells.json"), JSON.stringify(sorted));
  const icons = new Set(Object.values(sorted).flatMap((m) => m.spells.map((sp) => sp.icon)).filter(Boolean));
  await downloadIcons(icons);
  const spellCount = Object.values(sorted).reduce((n, m) => n + m.spells.length, 0);
  console.log(`${Object.keys(sorted).length} monstres, ${spellCount} sorts écrits dans data/spells.json`);
}

main();
