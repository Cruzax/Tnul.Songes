import { cleanDisplayText, cleanSectionText } from "../lib/text.js";
import { monsterImageUrl } from "../lib/images.js";

const detailNode = document.getElementById("monster-detail");

const MISSING_IMAGE_CLASS =
  "grid size-24 place-items-center rounded-lg border border-line bg-panel2 text-center text-xs text-muted";

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
  block.className = "border-t border-line pt-5 first:border-t-0 first:pt-0";

  const heading = document.createElement("h4");
  heading.className = "m-0 mb-3 flex items-center gap-2 text-sm font-medium text-ink";
  const headingIcon = { Information: ["info", "text-muted"], Conseil: ["sparkles", "text-accent"] }[title];
  if (headingIcon) {
    heading.append(decorativeIcon(headingIcon[0], `text-[0.95rem] leading-none ${headingIcon[1]}`));
  }
  heading.append(title);

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletCount = lines.filter((line) => /^[-*]\s+/.test(line)).length;
  const mostlyBullets = bulletCount >= 2 && bulletCount >= Math.ceil(lines.length / 2);

  const wrapper = document.createElement(mostlyBullets ? "ul" : "div");
  wrapper.className = mostlyBullets
    ? "m-0 ml-5 list-disc space-y-2.5 p-0 text-[13px] leading-relaxed text-muted marker:text-muted"
    : "space-y-2.5 text-[13px] leading-relaxed text-muted";

  lines.forEach((line) => {
    const entry = document.createElement(mostlyBullets ? "li" : "p");
    entry.className = mostlyBullets ? "" : "m-0";
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

// Jauge sur 10: dix petits segments, ceux remplis en couleur d'accent
function createRating(label, value) {
  const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.min(10, Number(value))) : 0;

  const row = document.createElement("div");
  row.className = "grid grid-cols-[110px_1fr_28px] items-center gap-3 text-xs";

  const name = document.createElement("span");
  name.className = "text-muted";
  name.textContent = label;

  const track = document.createElement("span");
  track.className = "rating-track !w-full";
  track.setAttribute("role", "meter");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "10");
  track.setAttribute("aria-valuenow", String(numeric));
  for (let i = 0; i < 10; i += 1) {
    const segment = document.createElement("i");
    if (i < numeric) {
      segment.className = "filled";
    }
    track.appendChild(segment);
  }

  const score = document.createElement("span");
  score.className = "text-right text-muted";
  const strong = document.createElement("span");
  strong.className = "text-ink";
  strong.textContent = String(value ?? "-");
  score.append(strong, "/10");

  row.append(name, track, score);
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
  image.className = "size-24 rounded-lg border border-line bg-panel2 object-contain p-1";
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
    "flex items-center gap-2.5 text-[11px] text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  button.setAttribute("aria-label", "Activer la version courte si possible");
  button.setAttribute("aria-pressed", isShortMode ? "true" : "false");
  button.disabled = !hasShortInfo;

  const track = document.createElement("span");
  track.className = "relative h-4 w-7 flex-none rounded-full bg-line transition-colors";
  track.classList.toggle("bg-accent", isShortMode);

  const knob = document.createElement("span");
  knob.className = "absolute left-[2px] top-[2px] h-3 w-3 rounded-full bg-ink transition-transform";
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
    editable: true,
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

const CARD_CLASS = "rounded-lg border border-line bg-panel p-5";

function createCard(label, headerExtra, iconName) {
  const card = document.createElement("section");
  card.className = CARD_CLASS;

  const header = document.createElement("div");
  header.className = "mb-6 flex items-center justify-between gap-3";

  const title = document.createElement("h4");
  title.className = "card-label flex items-center gap-2";
  if (iconName) {
    title.append(decorativeIcon(iconName, "text-[0.9rem] leading-none"));
  }
  title.append(label);

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

// Icône décorative (titres): couleur du texte autour
function decorativeIcon(name, className) {
  const wrapper = document.createElement("span");
  wrapper.className = className || "";
  wrapper.innerHTML = window.TnulIcons?.html(name) || "";
  return wrapper;
}

// Icône SVG (voir lib/icons.js) avec une étiquette accessible
function iconNode(name, className) {
  const wrapper = document.createElement("span");
  wrapper.className = className || "";
  wrapper.title = window.TnulIcons?.label(name) || name;
  wrapper.setAttribute("role", "img");
  wrapper.setAttribute("aria-label", wrapper.title);
  wrapper.innerHTML = window.TnulIcons?.html(name) || "";
  return wrapper;
}

const CHIP_CLASS = "inline-flex items-center gap-1.5 rounded border border-line bg-panel px-2 py-1 text-xs text-ink";

// Pastille « icône + valeur + libellé » (♥ 10 000 PV), comme sur la maquette
function createIconChip(iconName, value, label) {
  const chip = document.createElement("span");
  chip.className = CHIP_CLASS;
  const name = document.createElement("span");
  name.className = "text-muted";
  name.textContent = label;
  chip.append(iconNode(iconName, "text-[0.8rem] leading-none"), String(value), name);
  return chip;
}

function createChip(label, value) {
  const chip = document.createElement("span");
  chip.className = CHIP_CLASS;
  const name = document.createElement("span");
  name.className = "text-muted";
  name.textContent = label;
  chip.append(name, String(value));
  return chip;
}

// En-tête du monstre: portrait, nom, pastilles et jauges, sur toute la largeur
function createHero(monster, baseStats) {
  const hero = document.createElement("section");
  hero.className = "flex flex-col justify-between gap-8 border-b border-line pb-8 lg:flex-row lg:items-center";

  const identity = document.createElement("div");
  identity.className = "flex min-w-0 items-center gap-5";

  const media = document.createElement("div");
  media.className = "flex-none";
  renderImage(media, monster);

  const text = document.createElement("div");
  text.className = "min-w-0";

  const eyebrow = document.createElement("p");
  eyebrow.className = "card-label mb-2";
  eyebrow.textContent = monster.IsBounty ? "Avis de recherche" : "Songe infini";

  const title = document.createElement("h3");
  title.className = "m-0 text-3xl font-semibold leading-tight text-ink sm:text-4xl";
  title.textContent = cleanDisplayText(monster.Name || "Monstre sans nom");

  const chips = document.createElement("div");
  chips.className = "mt-3 flex flex-wrap items-center gap-2";
  if (baseStats) {
    if (hasLife(baseStats)) {
      chips.append(createIconChip("hp", formatNumber(baseStats.stats.life) + lifeSuffix(monster), "PV"));
    }
    chips.append(createChip("Niv.", baseStats.stats?.level ?? "?"), createIconChip("pa", baseStats.pa, "PA"), createIconChip("pm", baseStats.pm, "PM"));
  }

  text.append(eyebrow, title, chips);
  identity.append(media, text);
  hero.append(identity, createRatings(monster));
  return hero;
}

function createSummaryCard(monster, isShortMode, hasShortInfo, sections, onToggle) {
  const card = createCard("Résumé", createShortInfoToggle(isShortMode, hasShortInfo, onToggle), "book");

  const body = document.createElement("div");
  body.className = "grid gap-5";
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
  bars.className = "grid w-full flex-none gap-3 lg:w-[295px]";
  bars.append(
    createRating("Difficulté", monster.Difficulty),
    createRating("Focus immédiat", monster.ImmediateFocus),
    createRating("Évasion", monster.Evasion),
    createRating("Tanking", monster.Tanking)
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
  const card = createCard("Caractéristiques", null, "shield");

  // Quatre tuiles: icône, valeur, libellé
  const tiles = document.createElement("div");
  tiles.className = "mb-5 grid grid-cols-4 gap-2.5";
  [
    ...(hasLife(baseStats) ? [{ icon: "hp", label: monster.IsBounty ? "PV seul" : "PV", value: formatNumber(baseStats.stats.life) }] : []),
    { icon: "level", label: "Niveau", value: baseStats.stats?.level },
    { icon: "pa", label: "PA", value: baseStats.pa },
    { icon: "pm", label: "PM", value: baseStats.pm },
  ].forEach(({ icon, label, value }) => {
    const tile = document.createElement("div");
    tile.className = "rounded-md border border-line bg-panel2 px-1 py-3 text-center";
    const number = document.createElement("div");
    number.className = "mt-1.5 whitespace-nowrap text-base font-semibold text-ink";
    number.textContent = String(value ?? "-");
    const name = document.createElement("div");
    name.className = "mt-1 text-[9px] uppercase tracking-wider text-muted";
    name.textContent = label;
    tile.append(iconNode(icon, "block text-[0.95rem] leading-none"), number, name);
    tiles.appendChild(tile);
  });

  const rows = document.createElement("dl");
  rows.className = "m-0 space-y-3";
  BASE_STAT_ROWS.forEach(([label, key]) => {
    const value = baseStats.stats?.[key];
    if (value === undefined) {
      return;
    }
    const row = document.createElement("div");
    row.className = "flex items-center justify-between text-[13px]";
    const term = document.createElement("dt");
    term.className = "flex items-center gap-2.5 text-muted";
    term.append(iconNode(key, "text-[0.95rem] leading-none"), label);
    const detail = document.createElement("dd");
    detail.className = "m-0 font-medium tabular-nums text-ink";
    detail.textContent = formatNumber(value);
    row.append(term, detail);
    rows.appendChild(row);
  });

  const note = document.createElement("p");
  note.className = "m-0 mt-5 border-t border-line pt-4 text-[10px] leading-relaxed text-muted";
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

  const summary = createSummaryCard(monster, isShortMode, hasShortInfo, sections, () => {
    prefersShortInfo = !isShortMode;
    renderMonsterDetail(monster, prefersShortInfo);
  });
  summary.classList.add("min-w-0");

  const columns = document.createElement("div");
  columns.className = "grid items-stretch gap-6";
  columns.append(summary);
  if (baseStats?.stats) {
    columns.classList.add("lg:grid-cols-[minmax(0,1fr)_340px]");
    columns.append(createStatsCard(monster, baseStats));
  }

  detailNode.hidden = false;
  detailNode.innerHTML = "";
  detailNode.append(createHero(monster, baseStats), columns);
  mountSimulation(monster, detailNode);
}
