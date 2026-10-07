import { cleanDisplayText, cleanSectionText } from "../lib/text.js";
import { monsterImageUrl } from "../lib/images.js";

const detailNode = document.getElementById("monster-detail");

const MISSING_IMAGE_CLASS =
  "grid min-h-[120px] w-full place-items-center rounded-xl border border-slate-200/35 bg-white/10 text-sm text-slate-300";

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
  block.className = "rounded-xl border border-white/15 bg-white/10 px-3.5 py-3";

  const heading = document.createElement("h4");
  heading.className = "mb-2 text-base tracking-[0.01em] text-slate-100";
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
    entry.className = mostlyBullets ? "leading-6 text-slate-100" : "m-0 leading-6 text-slate-100";
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
  name.className = "text-[0.85rem] text-slate-200";
  name.textContent = label;

  const bar = document.createElement("div");
  bar.className = "h-[9px] overflow-hidden rounded-full bg-white/15";

  const fill = document.createElement("span");
  fill.className = "block h-full rounded-full bg-[linear-gradient(90deg,#76d1ff_0%,#93f0bb_45%,#ffd36f_75%,#ff8f8f_100%)]";
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  fill.style.width = `${Math.max(0, Math.min(10, numeric)) * 10}%`;

  const valueText = document.createElement("span");
  valueText.className = "text-right text-[0.82rem] text-slate-100";
  valueText.textContent = String(value ?? "-");

  bar.appendChild(fill);
  row.append(name, bar, valueText);
  return row;
}

function renderImage(container, monster) {
  container.className = "w-full";

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
  image.className = "min-h-[120px] w-full rounded-xl border border-slate-200/35 bg-slate-950/45 object-contain";
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
    "mt-3 flex w-full max-w-[260px] items-center justify-between gap-2 rounded-xl border border-sky-300/40 bg-white/10 px-2.5 py-2 text-slate-100 transition-colors hover:border-sky-300/70 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
  button.setAttribute("aria-label", "Activer Information courte si possible");
  button.setAttribute("aria-pressed", isShortMode ? "true" : "false");
  button.disabled = !hasShortInfo;

  const text = document.createElement("span");
  text.className = "grid text-left leading-[1.1]";

  const title = document.createElement("span");
  title.className = "text-[0.86rem] font-semibold";
  title.textContent = "Information courte";

  const hint = document.createElement("span");
  hint.className = "text-[0.72rem] text-slate-300";
  hint.textContent = "si possible";

  const track = document.createElement("span");
  track.className = "relative h-6 w-[42px] flex-none rounded-full bg-slate-400/50 transition-colors";
  track.classList.toggle("bg-emerald-500", isShortMode);

  const knob = document.createElement("span");
  knob.className = "absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform";
  knob.classList.toggle("translate-x-[18px]", isShortMode);

  track.appendChild(knob);
  text.append(title, hint);
  button.append(text, track);
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

// ---------- Fiche complète ----------

export function renderMonsterDetail(monster, showShort = prefersShortInfo) {
  if (!detailNode) {
    return;
  }

  detailNode.hidden = false;
  detailNode.innerHTML = "";

  const shortSections = getSections(monster, true);
  const hasShortInfo = shortSections.length > 0;
  const isShortMode = hasShortInfo && showShort;

  const media = document.createElement("div");
  renderImage(media, monster);

  const title = document.createElement("h3");
  title.className = "m-0 text-2xl text-slate-100";
  title.textContent = cleanDisplayText(monster.Name || "Monstre sans nom");

  const stats = document.createElement("div");
  stats.className = "grid max-w-[360px] gap-2";
  stats.append(
    createStatBar("Difficulte", monster.Difficulty),
    createStatBar("Focus immediat", monster.ImmediateFocus),
    createStatBar("Evasion", monster.Evasion),
    createStatBar("Tanking", monster.Tanking)
  );

  const toggle = createShortInfoToggle(isShortMode, hasShortInfo, () => {
    prefersShortInfo = !isShortMode;
    renderMonsterDetail(monster, prefersShortInfo);
  });

  const info = document.createElement("div");
  info.append(title, stats, toggle);

  const head = document.createElement("div");
  head.className = "grid items-start gap-3.5 md:grid-cols-[140px_1fr]";
  head.append(media, info);

  const grid = document.createElement("div");
  grid.className = "mt-4 grid gap-2.5";
  (isShortMode ? shortSections : getSections(monster, false)).forEach((section) => {
    appendTextSection(grid, section.title, section.content);
  });
  if (!grid.childElementCount) {
    appendTextSection(grid, "Details", "Aucune information supplementaire.");
  }

  detailNode.append(head, grid);
  mountSimulation(monster, detailNode);
  playTransition(grid);
}
