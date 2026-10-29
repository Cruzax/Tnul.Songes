// Usage: node tools/build-alignement.js   (depuis le dossier du site, Node 18+)
// Écrit data/alignement.json depuis DofusDB: les quêtes d'alignement de Bonta et de Brâkmar, avec pour chacune
// son niveau, son rang d'alignement, ses étapes et ce qu'elle demande (objets et leur métier, combats, donjons).
// Les requêtes sont espacées pour ne pas charger l'API.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API = "https://api.dofusdb.fr";
const SIDES = { 9: "bonta", 10: "brakmar" }; // catégories « Alignement Bonta » et « Alignement Brâkmar »

// Ressources récoltées (pas de recette): métier de récolte d'après le type d'objet
const HARVEST = { Bois: "Bûcheron", Minerai: "Mineur", "Céréale": "Paysan", Fleur: "Alchimiste", Plante: "Alchimiste", Bourgeon: "Alchimiste", Poisson: "Pêcheur" };

// Étapes qui demandent l'aide d'autres joueurs: ce n'est écrit que dans le texte de l'étape, pas dans les données
const HELP = {
  259: "Descendre dans le repaire des bandits à plusieurs (« N'y allez pas seul ! »)",
  261: "Inspecter le repaire à plusieurs, avec une corde d'escalade",
  262: "Un complice pour détourner l'attention du garde",
  263: "Un Sram ou un espion qualifié pour entrer dans les réserves de poison",
  264: "Un bricoleur compétent pour fouiller la maison de Xarthan",
  286: "Plusieurs aventuriers pour le rituel des lacs Koalaks",
  333: "Des personnes de confiance pour la mise en scène de la Corne",
  248: "Un bricoleur pour descendre",
  252: "Un milicien qualifié, puis des artisans expérimentés pour le passage secret",
  256: "De l'aide pour désamorcer les pièges du repaire",
  445: "Des Brâkmariens qui ont déjà choisi un Ordre, pour capturer les trois âmes",
  278: "Des renforts pour intercepter le convoi d'armes",
};

// Issues au choix d'une quête (Brâkmar): le tacticien (tué, épargné ou acheté) et l'espion blessé
const CHOICES = new Set([272, 273, 274, 311, 312]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      // nouvel essai
    }
    await sleep(2000 * (i + 1));
  }
  throw new Error(`Échec: ${url}`);
}

// Liste paginée (50 par page), avec un filtre « champ[$in][]=id » ou une requête libre
async function getAll(endpoint, ids, field = "id") {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const filter = ids.slice(i, i + 50).map((id) => `${field}[$in][]=${id}`).join("&");
    const page = await getJson(`${API}/${endpoint}?${filter}&$limit=50&lang=fr`);
    out.push(...page.data);
    await sleep(1500);
  }
  return out;
}

async function questsOf(categoryId) {
  const out = [];
  for (let skip = 0; ; skip += 50) {
    const page = await getJson(`${API}/quests?categoryId=${categoryId}&$limit=50&$skip=${skip}&lang=fr`);
    out.push(...page.data);
    await sleep(1500);
    if (skip + 50 >= page.total) return out;
  }
}

const fr = (text) => (text && text.fr) || "";
const unique = (list) => [...new Set(list)];

async function main() {
  const quests = [];
  for (const categoryId of Object.keys(SIDES)) quests.push(...(await questsOf(categoryId)));
  const objectiveIds = unique(quests.flatMap((quest) => (quest.steps || []).flatMap((step) => step.objectiveIds)));
  const objectives = new Map((await getAll("quest-objectives", objectiveIds)).map((o) => [o.id, o]));

  const itemOf = (o) => (o.typeId === 17 ? o.parameters.parameter0 : o.parameters.parameter1);
  const itemIds = unique([...objectives.values()].filter((o) => [2, 3, 17].includes(o.typeId)).map(itemOf));
  const monsterIds = unique([...objectives.values()].filter((o) => [6, 14, 16].includes(o.typeId)).map((o) => o.parameters.parameter0));
  const items = new Map((await getAll("items", itemIds)).map((item) => [item.id, item]));
  const types = new Map((await getAll("item-types", unique([...items.values()].map((item) => item.typeId)))).map((t) => [t.id, t]));
  const craftable = [...items.values()].filter((item) => item.hasRecipe).map((item) => item.id);
  const recipes = new Map((await getAll("recipes", craftable, "resultId")).map((r) => [r.resultId, r]));
  const monsters = new Map((await getAll("monsters", monsterIds)).map((m) => [m.id, m]));

  // D'où vient un objet: fabriqué (métier), récolté (métier), lâché par des monstres, ou donné par la quête
  function source(id) {
    const item = items.get(id);
    const type = fr(types.get(item.typeId)?.name);
    const recipe = recipes.get(id);
    if (recipe) {
      const job = fr(recipe.job?.name);
      return job && job !== "Base" ? { src: "craft", job } : { src: "craft" };
    }
    if (HARVEST[type]) return { src: "recolte", job: HARVEST[type] };
    if (item.dropMonsterIds && item.dropMonsterIds.length) return { src: "drop" };
    return { src: type === "Alignement" ? "quete" : "autre" };
  }

  const out = quests.map((quest) => {
    const criterion = quest.startCriterion || "";
    const rank = criterion.match(/Pa[=>](\d+)/);
    const order = /Pr=/.test(criterion) || /^Apprentissage/.test(fr(quest.name));
    const count = { parler: 0, objets: 0, cartes: 0, combats: 0, fabriquer: 0, autres: 0 };
    const needs = [];
    const fights = [];
    let dungeon = false;
    (quest.steps || []).forEach((step) => step.objectiveIds.forEach((id) => {
      const o = objectives.get(id);
      if (!o) return;
      const p = o.parameters;
      if (p.dungeonOnly) dungeon = true;
      if (o.typeId === 1) count.parler += 1;
      else if (o.typeId === 2 || o.typeId === 3 || o.typeId === 17) {
        count[o.typeId === 17 ? "fabriquer" : "objets"] += 1;
        const item = items.get(itemOf(o));
        if (item) needs.push({ name: fr(item.name), qty: o.typeId === 17 ? p.parameter1 : p.parameter2, ...source(item.id), ...(o.typeId === 17 ? { make: true } : {}) });
      } else if (o.typeId === 4 || o.typeId === 5) count.cartes += 1;
      else if ([6, 14, 16].includes(o.typeId)) {
        count.combats += 1;
        const monster = monsters.get(p.parameter0);
        if (monster) fights.push({ name: fr(monster.name), qty: p.parameter1 || 1 });
      } else count.autres += 1;
    }));
    return {
      id: quest.id,
      side: SIDES[quest.categoryId],
      name: fr(quest.name),
      level: quest.levelMin,
      rank: rank ? Number(rank[1]) : null,
      kind: order ? "ordre" : CHOICES.has(quest.id) || !rank ? "choix" : "principale",
      steps: (quest.steps || []).map((step) => fr(step.name)),
      count,
      needs,
      fights,
      dungeon,
      ...(HELP[quest.id] ? { help: HELP[quest.id] } : {}),
    };
  }).sort((a, b) => a.level - b.level || a.id - b.id);

  const file = path.join(ROOT, "data", "alignement.json");
  fs.writeFileSync(file, `${JSON.stringify({ source: "DofusDB", generated: new Date().toISOString().slice(0, 10), quests: out })}\n`);
  console.log(`${out.length} quêtes écrites dans data/alignement.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
