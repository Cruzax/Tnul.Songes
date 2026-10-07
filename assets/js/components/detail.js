import { cleanDisplayText, cleanSectionText } from "../lib/text.js";
import { monsterImageUrl } from "../lib/images.js";

const detailNode = document.getElementById("monster-detail");

const MISSING_IMAGE_CLASS =
  "grid aspect-square w-full place-items-center rounded-2xl border border-line bg-white/5 text-sm text-muted";

let spellsData = {};
let prefersShortInfo = false;

export function setSpellsData(data) {
  spellsData = data || {};
}

// ---------- Texte ----------

// Ajoute une ligne de texte en gardant les liens <a> cliquables et en nettoyant le reste
function appendLineWithLinks(container, line) {
  const rawLine = String(line || "").replace(/^[-*]\s+/, "");
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;

  let lastIndex = 0;
  let match;
  let hasLink = false;

  while ((match = linkPattern.exec(rawLine)) !== null) {
    hasLink = true;

    const before = rawLine.slice(lastIndex, match.index);
    if (before) {
      container.appendChild(document.createTextNode(cleanDisplayText(before)));
    }

    const anchor = document.createElement("a");
    anchor.href = match[1];
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = cleanDisplayText(match[2]);
    container.appendChild(anchor);

    lastIndex = linkPattern.lastIndex;
  }

  if (!hasLink) {
    container.textContent = cleanDisplayText(rawLine);
    return;
  }

  const after = rawLine.slice(lastIndex);
  if (after) {
    container.appendChild(document.createTextNode(cleanDisplayText(after)));
  }
}

function appendTextSection(container, title, content) {
  const clean = cleanSectionText(content);
  if (!clean) {
    return;
  }

  const block = document.createElement("section");
  block.className = "border-t border-line pt-3 first:border-t-0 first:pt-0";

  const heading = document.createElement("h4");
  heading.className = "mb-1.5 text-[0.95rem] font-semibold text-ink";
  heading.textContent = title;

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletCount = lines.filter((line) => /^[-*]\s+/.test(line)).length;
  const mostlyBullets = bulletCount >= 2 && bulletCount >= Math.ceil(lines.length / 2);

  const wrapper = document.createElement(mostlyBullets ? "ul" : "div");
  wrapper.className = mostlyBullets ? "m-0 grid list-disc gap-1.5 pl-5" : "space-y-2";

  lines.forEach((line) => {
    const entry = document.createElement(mostlyBullets ? "li" : "p");
    entry.className = mostlyBullets ? "leading-6 text-ink" : "m-0 leading-6 text-ink";
    appendLineWithLinks(entry, line);
    wrapper.appendChild(entry);
  });

  block.append(heading, wrapper);
  container.appendChild(block);
}

// Sections affichées pour un boss, en version courte ou longue
function getSections(monster, short) {
  const suffix = short ? "Short" : "";
  return [
    { title: "Information", content: cleanSectionText(monster?.[`Information${suffix}`]) },
    { title: "Conseil", content: cleanSectionText(monster?.[`Advice${suffix}`]) },
    { title: "Mecanique", content: cleanSectionText(monster?.[`Mechanic${suffix}`]) },
  ].filter((section) => section.content);
}

// ---------- Blocs de la fiche ----------

function createStatBar(label, value) {
  const row = document.createElement("div");
  row.className = "grid grid-cols-[112px_1fr_28px] items-center gap-2";

  const name = document.createElement("span");
  name.className = "text-[0.85rem] text-ink";
  name.textContent = label;

  const bar = document.createElement("div");
  bar.className = "h-[9px] overflow-hidden rounded-full bg-white/15";

  const fill = document.createElement("span");
  fill.className = "block h-full rounded-full bg-[linear-gradient(90deg,#76d1ff_0%,#93f0bb_45%,#ffd36f_75%,#ff8f8f_100%)]";
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  fill.style.width = `${Math.max(0, Math.min(10, numeric)) * 10}%`;

  const valueText = document.createElement("span");
  valueText.className = "text-right text-[0.82rem] text-ink";
  valueText.textContent = String(value ?? "-");

  bar.appendChild(fill);
  row.append(name, bar, valueText);
  return row;
}

function renderImage(container, monster) {
  const showMissing = () => {
    container.innerHTML = "";
    const fallback = document.createElement("div");
    fallback.className = MISSING_IMAGE_CLASS;
    fallback.textContent = "Image introuvable";
    container.appendChild(fallback);
  };

  if (!monster.Image) {
    showMissing();
    return;
  }

  const image = document.createElement("img");
  image.className = "aspect-square w-full rounded-2xl border border-accent/30 bg-panel2 object-contain p-1";
  image.alt = cleanDisplayText(monster.Name || "Monstre");
  image.loading = "lazy";
  image.src = monsterImageUrl(monster.Image);
  image.addEventListener("error", showMissing);
  container.appendChild(image);
}

function createShortInfoToggle(isShortMode, hasShortInfo, onToggle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "flex items-center gap-2 rounded-full border border-line bg-white/5 px-2.5 py-1 text-[0.75rem] text-ink transition-colors hover:border-accent/70 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  button.setAttribute("aria-label", "Activer la version courte si possible");
  button.setAttribute("aria-pressed", isShortMode ? "true" : "false");
  button.disabled = !hasShortInfo;

  const track = document.createElement("span");
  track.className = "relative h-4 w-7 flex-none rounded-full bg-white/20 transition-colors";
  track.classList.toggle("bg-accent", isShortMode);

  const knob = document.createElement("span");
  knob.className = "absolute left-[2px] top-[2px] h-3 w-3 rounded-full bg-white transition-transform";
  knob.classList.toggle("translate-x-3", isShortMode);

  track.appendChild(knob);
  button.append("Version courte", track);
  button.addEventListener("click", () => hasShortInfo && onToggle());
  return button;
}

// Carte de simulation sous la fiche (masquée si le boss n'a pas de données dans data/spells.json)
function mountSimulation(monster, parentNode) {
  const data = spellsData[monster.Id];
  if (!data?.spells?.length || !window.TnulSimulator) {
    return;
  }

  const container = document.createElement("div");
  parentNode.appendChild(container);
  window.TnulSimulator.mount(container, {
    monsterName: cleanDisplayText(monster.Name || ""),
    imageUrls: monster.Image ? [monsterImageUrl(monster.Image)] : [],
    data,
    compactGrid: true,
  });
}

function playTransition(targetNode) {
  targetNode.classList.remove("animate-detail-grid-in");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  // Force un reflow pour que l'animation se rejoue à chaque changement de boss
  void targetNode.offsetWidth;
  targetNode.classList.add("animate-detail-grid-in");
}

// ---------- Cartes ----------

const CARD_CLASS = "rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-[10px]";

function createCard(label, headerExtra) {
  const card = document.createElement("section");
  card.className = CARD_CLASS;

  const header = document.createElement("div");
  header.className = "mb-3 flex items-center justify-between gap-3";

  const title = document.createElement("h4");
  title.className = "card-label";
  title.textContent = label;

  header.appendChild(title);
  if (headerExtra) {
    header.appendChild(headerExtra);
  }
  card.appendChild(header);
  return card;
}

// Sans ratio de PV dans les données, le calcul donne 1: on n'affiche alors rien
function hasLife(baseStats) {
  return Number(baseStats?.stats?.life) > 1;
}

// Un avis de recherche perd des PV quand il y a plusieurs mobs dans le combat: l'estimation vaut pour lui seul
function lifeSuffix(monster) {
  return monster.IsBounty ? " (seul)" : "";
}

function formatNumber(value) {
  return Number(value).toLocaleString("fr-FR");
}

function createChip(label, value) {
  const chip = document.createElement("span");
  chip.className = "inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-2.5 py-1 text-[0.78rem] text-ink";
  const name = document.createElement("span");
  name.className = "text-muted";
  name.textContent = label;
  chip.append(name, String(value));
  return chip;
}

function createHero(monster, baseStats) {
  const hero = document.createElement("section");
  hero.className = `${CARD_CLASS} flex items-center gap-5 max-[900px]:flex-col max-[900px]:text-center`;

  const media = document.createElement("div");
  media.className = "w-28 flex-none";
  renderImage(media, monster);

  const text = document.createElement("div");
  text.className = "min-w-0 flex-1";

  const eyebrow = document.createElement("p");
  eyebrow.className = "card-label mb-1";
  eyebrow.textContent = monster.IsBounty ? "Avis de recherche" : "Songe infini";

  const title = document.createElement("h3");
  title.className = "m-0 text-[1.75rem] font-bold leading-tight text-ink";
  title.textContent = cleanDisplayText(monster.Name || "Monstre sans nom");

  const chips = document.createElement("div");
  chips.className = "mt-3 flex flex-wrap gap-2 max-[900px]:justify-center";
  if (baseStats) {
    if (hasLife(baseStats)) {
      chips.append(createChip("PV", formatNumber(baseStats.stats.life) + lifeSuffix(monster)));
    }
    chips.append(createChip("Niv.", baseStats.stats?.level ?? "?"), createChip("PA", baseStats.pa), createChip("PM", baseStats.pm));
  }

  text.append(eyebrow, title, chips);
  hero.append(media, text, createRatings(monster));
  return hero;
}

function createSummaryCard(monster, isShortMode, hasShortInfo, sections, onToggle) {
  const card = createCard("Résumé", createShortInfoToggle(isShortMode, hasShortInfo, onToggle));

  const body = document.createElement("div");
  body.className = "grid gap-4";
  sections.forEach((section) => appendTextSection(body, section.title, section.content));
  if (!body.childElementCount) {
    appendTextSection(body, "Details", "Aucune information supplementaire.");
  }

  card.appendChild(body);
  playTransition(body);
  return card;
}

function createRatings(monster) {
  const bars = document.createElement("div");
  bars.className = "grid w-full max-w-[320px] flex-none gap-2 max-[900px]:max-w-none";
  bars.append(
    createStatBar("Difficulte", monster.Difficulty),
    createStatBar("Focus immediat", monster.ImmediateFocus),
    createStatBar("Evasion", monster.Evasion),
    createStatBar("Tanking", monster.Tanking)
  );
  return bars;
}

const BASE_STAT_ROWS = [
  ["Force", "strength"],
  ["Intelligence", "intelligence"],
  ["Chance", "chance"],
  ["Agilité", "agility"],
  ["Puissance", "power"],
];

function createStatsCard(monster, baseStats) {
  const card = createCard("Caractéristiques");

  const tiles = document.createElement("div");
  tiles.className = "grid grid-cols-2 gap-2";
  [
    ...(hasLife(baseStats) ? [[monster.IsBounty ? "PV (estimés, seul)" : "PV (estimés)", formatNumber(baseStats.stats.life)]] : []),
    ["Niveau", baseStats.stats?.level],
    ["PA", baseStats.pa],
    ["PM", baseStats.pm],
  ].forEach(([label, value]) => {
    const tile = document.createElement("div");
    tile.className = "rounded-xl border border-line bg-white/5 px-2 py-2 text-center";
    const name = document.createElement("div");
    name.className = "text-[0.7rem] uppercase tracking-wider text-muted";
    name.textContent = label;
    const number = document.createElement("div");
    number.className = "text-xl font-bold text-ink";
    number.textContent = String(value ?? "-");
    tile.append(name, number);
    tiles.appendChild(tile);
  });

  const rows = document.createElement("dl");
  rows.className = "m-0 mt-3 grid gap-1.5";
  BASE_STAT_ROWS.forEach(([label, key]) => {
    const value = baseStats.stats?.[key];
    if (value === undefined) {
      return;
    }
    const row = document.createElement("div");
    row.className = "flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-[0.85rem]";
    const term = document.createElement("dt");
    term.className = "text-muted";
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.className = "m-0 font-semibold text-ink";
    detail.textContent = String(value);
    row.append(term, detail);
    rows.appendChild(row);
  });

  const note = document.createElement("p");
  note.className = "m-0 mt-3 text-[0.72rem] leading-snug text-muted";
  note.textContent = "Estimation au palier 225 (Paradoxe I, palier II). Les valeurs évoluent avec le palier du Songe.";

  card.append(tiles, rows, note);
  return card;
}

// ---------- Fiche complète ----------

export function renderMonsterDetail(monster, showShort = prefersShortInfo) {
  if (!detailNode) {
    return;
  }

  const baseStats = spellsData[monster.Id];
  const shortSections = getSections(monster, true);
  const hasShortInfo = shortSections.length > 0;
  const isShortMode = hasShortInfo && showShort;
  const sections = isShortMode ? shortSections : getSections(monster, false);

  const main = document.createElement("div");
  main.className = "grid min-w-0 gap-4";
  main.appendChild(
    createSummaryCard(monster, isShortMode, hasShortInfo, sections, () => {
      prefersShortInfo = !isShortMode;
      renderMonsterDetail(monster, prefersShortInfo);
    })
  );

  const side = document.createElement("div");
  side.className = "grid gap-4";
  if (baseStats?.stats) {
    side.appendChild(createStatsCard(monster, baseStats));
  }

  const columns = document.createElement("div");
  columns.className = `grid items-stretch gap-4 ${side.childElementCount ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`;
  columns.append(main);
  if (side.childElementCount) {
    columns.append(side);
  }

  detailNode.hidden = false;
  detailNode.innerHTML = "";
  detailNode.append(createHero(monster, baseStats), columns);
  mountSimulation(monster, detailNode);
}

