import { cleanDisplayText, normalizeText } from "../lib/text.js";
import { createInitialFallback, monsterImageUrl } from "../lib/images.js";

const input = document.getElementById("monster-search");
const resultsNode = document.getElementById("search-results");

const FALLBACK_CLASS =
  "grid h-full w-full place-items-center bg-panel text-[0.85rem] text-muted";

let allMonsters = [];
let lastResults = [];

export function setSearchValue(value) {
  if (input) {
    input.value = value;
  }
}

export function closeSearchResults() {
  if (!resultsNode) {
    return;
  }
  resultsNode.hidden = true;
  resultsNode.innerHTML = "";
}

function buildResultItem(monster, onSelect) {
  const name = cleanDisplayText(monster.Name || "Monstre");

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "flex w-full items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-ink transition-colors hover:bg-white/5";

  const media = document.createElement("span");
  media.className = "grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg";

  const fallback = createInitialFallback(name, FALLBACK_CLASS, "span");
  if (monster.Image) {
    const image = document.createElement("img");
    image.className = "h-full w-full object-contain";
    image.loading = "lazy";
    image.alt = "";
    image.src = monsterImageUrl(monster.Image);
    image.addEventListener("error", () => {
      media.innerHTML = "";
      media.appendChild(fallback);
    });
    media.appendChild(image);
  } else {
    media.appendChild(fallback);
  }

  const label = document.createElement("span");
  label.className = "min-w-0 flex-1 truncate";
  label.textContent = name;

  button.append(media, label);
  button.addEventListener("click", () => onSelect(monster));
  return button;
}

function openResults(monsters, onSelect) {
  if (!resultsNode) {
    return;
  }

  lastResults = monsters;
  resultsNode.hidden = false;
  resultsNode.innerHTML = "";

  if (!monsters.length) {
    const empty = document.createElement("p");
    empty.className = "m-0 px-2.5 py-2 text-[0.92rem] text-muted";
    empty.textContent = "Aucun monstre trouve.";
    resultsNode.appendChild(empty);
    return;
  }

  monsters.forEach((monster) => resultsNode.appendChild(buildResultItem(monster, onSelect)));
}

// Recherche dans le nom, l'id et tous les textes de la fiche, sans tenir compte des accents
function filterMonsters(query) {
  return allMonsters.filter((monster) => {
    const blob = normalizeText(
      [
        monster.Name,
        monster.Id,
        monster.Information,
        monster.InformationShort,
        monster.Advice,
        monster.AdviceShort,
        monster.Mechanic,
        monster.MechanicShort,
      ].join(" ")
    );
    return blob.includes(query);
  });
}

export function initSearch(monsters, onSelect) {
  allMonsters = monsters;
  if (!input) {
    return;
  }

  const refresh = () => {
    const query = normalizeText(input.value);
    openResults(query ? filterMonsters(query) : allMonsters, onSelect);
  };

  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("click", () => openResults(allMonsters, onSelect));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && lastResults.length) {
      event.preventDefault();
      onSelect(lastResults[0]);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Node && !resultsNode?.contains(target) && target !== input) {
      closeSearchResults();
    }
  });
}
