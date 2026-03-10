const searchInput = document.getElementById("monster-search");
const searchResultsNode = document.getElementById("search-results");
const movingMenuTrack = document.querySelector(".moving-menu-track");
const monsterDetailNode = document.getElementById("monster-detail");

let allMonsters = [];
let lastFilteredMonsters = [];
let prefersShortInfo = false;

function isEasterEgg(monster) {
  const name = normalizeText(monster?.Name || "");
  return Number(monster?.Id) >= 3000000 || name === "crocus";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanDisplayText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function buildImagePath(basePath, fileName) {
  return `${basePath}/${encodeURIComponent(String(fileName || ""))}`;
}

function createStatChip(label, value) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const name = document.createElement("span");
  name.className = "stat-name";
  name.textContent = label;

  const bar = document.createElement("div");
  bar.className = "stat-bar";

  const fill = document.createElement("span");
  fill.className = "stat-fill";
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamped = Math.max(0, Math.min(10, numericValue));
  fill.style.width = `${clamped * 10}%`;

  const valueText = document.createElement("span");
  valueText.className = "stat-value";
  valueText.textContent = String(value ?? "-");

  bar.appendChild(fill);
  row.append(name, bar, valueText);
  return row;
}

function renderScrollingMonsterMenu(monsters) {
  if (!movingMenuTrack) {
    return;
  }

  const previewMonsters = monsters.slice(0, 50);

  if (!previewMonsters.length) {
    movingMenuTrack.innerHTML = "<span>Aucun monstre charge</span>";
    return;
  }

  const fullList = [...previewMonsters, ...previewMonsters];
  movingMenuTrack.innerHTML = "";

  fullList.forEach((monster, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu-monster-item";
    item.title = cleanDisplayText(monster.Name || "Monstre");
    item.addEventListener("click", () => selectMonster(monster));

    const media = document.createElement("div");
    media.className = "menu-monster-media";

    const image = document.createElement("img");
    image.className = "menu-monster-thumb";
    image.loading = "lazy";
    image.alt = cleanDisplayText(monster.Name || "Monstre");

    const nameLabel = document.createElement("span");
    nameLabel.className = "menu-monster-name";
    nameLabel.textContent = cleanDisplayText(monster.Name || "Monstre");

    const fallback = document.createElement("div");
    fallback.className = "menu-monster-fallback";
    fallback.textContent = (cleanDisplayText(monster.Name || "M").charAt(0) || "M").toUpperCase();

    function showFallback() {
      media.innerHTML = "";
      media.appendChild(fallback);
    }

    if (monster.Image) {
      image.src = buildImagePath("assets/images/monsters", monster.Image);
      media.appendChild(image);
    } else {
      showFallback();
    }

    image.addEventListener("error", () => {
      if (!image.dataset.triedWorkspaceFolder && monster.Image) {
        image.dataset.triedWorkspaceFolder = "1";
        image.src = buildImagePath("Images", monster.Image);
        return;
      }
      showFallback();
    });

    item.append(media, nameLabel);

    if (index >= previewMonsters.length) {
      item.setAttribute("aria-hidden", "true");
      item.tabIndex = -1;
    }
    movingMenuTrack.appendChild(item);
  });
}

function closeSearchResults() {
  if (!searchResultsNode) {
    return;
  }
  searchResultsNode.hidden = true;
  searchResultsNode.innerHTML = "";
}

function appendTextSection(container, title, content) {
  const clean = cleanDisplayText(content);
  if (!clean) {
    return;
  }

  const block = document.createElement("section");
  block.className = "detail-block";

  const heading = document.createElement("h4");
  heading.textContent = title;

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const mostlyBullets = bulletLines.length >= 2 && bulletLines.length >= Math.ceil(lines.length / 2);

  if (mostlyBullets) {
    const list = document.createElement("ul");
    list.className = "detail-list";

    lines.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line.replace(/^[-*]\s+/, "");
      list.appendChild(item);
    });

    block.append(heading, list);
  } else {
    const textWrap = document.createElement("div");
    textWrap.className = "detail-paragraphs";

    lines.forEach((line) => {
      const text = document.createElement("p");
      text.textContent = line.replace(/^[-*]\s+/, "");
      textWrap.appendChild(text);
    });

    block.append(heading, textWrap);
  }

  container.appendChild(block);
}

function getShortInfoSections(monster) {
  const sections = [];
  const info = cleanDisplayText(monster?.InformationShort || "");
  const advice = cleanDisplayText(monster?.AdviceShort || "");
  const mechanic = cleanDisplayText(monster?.MechanicShort || "");

  if (info) {
    sections.push({ title: "Information", content: info });
  }
  if (advice) {
    sections.push({ title: "Conseil", content: advice });
  }
  if (mechanic) {
    sections.push({ title: "Mecanique", content: mechanic });
  }

  return sections;
}

function getLongInfoSections(monster) {
  const sections = [];
  const info = cleanDisplayText(monster?.Information || "");
  const advice = cleanDisplayText(monster?.Advice || "");
  const mechanic = cleanDisplayText(monster?.Mechanic || "");

  if (info) {
    sections.push({ title: "Information", content: info });
  }
  if (advice) {
    sections.push({ title: "Conseil", content: advice });
  }
  if (mechanic) {
    sections.push({ title: "Mecanique", content: mechanic });
  }

  return sections;
}

function renderDetailImage(container, monster) {
  if (!monster.Image) {
    const fallback = document.createElement("div");
    fallback.className = "monster-detail-fallback";
    fallback.textContent = "Image introuvable";
    container.appendChild(fallback);
    return;
  }

  const image = document.createElement("img");
  image.className = "monster-detail-image";
  image.alt = cleanDisplayText(monster.Name || "Monstre");
  image.loading = "lazy";
  image.src = buildImagePath("assets/images/monsters", monster.Image);

  image.addEventListener("error", () => {
    if (!image.dataset.triedWorkspaceFolder) {
      image.dataset.triedWorkspaceFolder = "1";
      image.src = buildImagePath("Images", monster.Image);
      return;
    }

    container.innerHTML = "";
    const fallback = document.createElement("div");
    fallback.className = "monster-detail-fallback";
    fallback.textContent = "Image introuvable";
    container.appendChild(fallback);
  });

  container.appendChild(image);
}

function renderMonsterDetail(monster, showShort = false) {
  if (!monsterDetailNode) {
    return;
  }

  monsterDetailNode.hidden = false;
  monsterDetailNode.innerHTML = "";

  const head = document.createElement("div");
  head.className = "monster-detail-head";

  const media = document.createElement("div");
  renderDetailImage(media, monster);

  const info = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "monster-detail-title";
  title.textContent = cleanDisplayText(monster.Name || "Monstre sans nom");

  const stats = document.createElement("div");
  stats.className = "monster-detail-stats";
  stats.append(
    createStatChip("Difficulte", monster.Difficulty),
    createStatChip("Focus immediat", monster.ImmediateFocus),
    createStatChip("Evasion", monster.Evasion),
    createStatChip("Tanking", monster.Tanking)
  );

  const shortInfoButton = document.createElement("button");
  shortInfoButton.type = "button";
  shortInfoButton.className = "short-info-toggle";
  shortInfoButton.setAttribute("aria-label", "Activer Information courte si possible");
  const shortSections = getShortInfoSections(monster);
  const longSections = getLongInfoSections(monster);
  const hasShortInfo = shortSections.length > 0;
  const isShortMode = hasShortInfo ? showShort : false;

  const toggleText = document.createElement("span");
  toggleText.className = "short-info-toggle-text";

  const toggleTitle = document.createElement("span");
  toggleTitle.className = "short-info-toggle-title";
  toggleTitle.textContent = "Information courte";

  const toggleHint = document.createElement("span");
  toggleHint.className = "short-info-toggle-hint";
  toggleHint.textContent = "si possible";

  const toggleTrack = document.createElement("span");
  toggleTrack.className = "short-info-switch";

  const toggleKnob = document.createElement("span");
  toggleKnob.className = "short-info-switch-knob";

  toggleTrack.appendChild(toggleKnob);
  toggleText.append(toggleTitle, toggleHint);
  shortInfoButton.append(toggleText, toggleTrack);

  shortInfoButton.setAttribute("aria-pressed", isShortMode ? "true" : "false");
  shortInfoButton.classList.toggle("is-on", isShortMode);
  shortInfoButton.disabled = !hasShortInfo;
  shortInfoButton.addEventListener("click", () => {
    if (!hasShortInfo) {
      return;
    }
    prefersShortInfo = !isShortMode;
    renderMonsterDetail(monster, prefersShortInfo);
  });

  info.append(title, stats, shortInfoButton);
  head.append(media, info);

  const grid = document.createElement("div");
  grid.className = "monster-detail-grid";

  if (isShortMode) {
    shortSections.forEach((section) => {
      appendTextSection(grid, section.title, section.content);
    });
  } else {
    longSections.forEach((section) => {
      appendTextSection(grid, section.title, section.content);
    });
  }

  if (!grid.childElementCount) {
    appendTextSection(grid, "Details", "Aucune information supplementaire.");
  }

  monsterDetailNode.append(head, grid);
}

function selectMonster(monster) {
  if (!monster) {
    return;
  }

  document.body.classList.add("menu-compact");

  if (searchInput) {
    searchInput.value = cleanDisplayText(monster.Name || "");
  }

  renderMonsterDetail(monster, prefersShortInfo);
  closeSearchResults();
}

function buildSearchResultItem(monster) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-result-item";
  button.textContent = cleanDisplayText(monster.Name || "Monstre");
  button.addEventListener("click", () => selectMonster(monster));
  return button;
}

function openSearchResults(filtered) {
  if (!searchResultsNode) {
    return;
  }

  searchResultsNode.hidden = false;
  searchResultsNode.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "search-result-empty";
    empty.textContent = "Aucun monstre trouve.";
    searchResultsNode.appendChild(empty);
    return;
  }

  filtered.forEach((monster) => {
    searchResultsNode.appendChild(buildSearchResultItem(monster));
  });
}

function filterMonsters(query) {
  return allMonsters.filter((monster) => {
    const blob = normalizeText([
      monster.Name,
      monster.Id,
      monster.Information,
      monster.InformationShort,
      monster.Advice,
      monster.AdviceShort,
      monster.Mechanic,
      monster.MechanicShort
    ].join(" "));
    return blob.includes(query);
  });
}

function handleSearchInput() {
  const query = normalizeText(searchInput?.value || "");

  if (!query) {
    lastFilteredMonsters = allMonsters;
    openSearchResults(allMonsters);
    return;
  }

  const filtered = filterMonsters(query);
  lastFilteredMonsters = filtered;

  openSearchResults(filtered);
}

function showAllSuggestions() {
  lastFilteredMonsters = allMonsters;
  openSearchResults(allMonsters);
}

async function init() {
  try {
    document.body.classList.remove("menu-compact");

    if (!window.jsyaml) {
      throw new Error("La librairie js-yaml n'est pas chargee.");
    }

    const response = await fetch("data/monsters.yaml");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const yamlText = await response.text();
    const parsed = window.jsyaml.load(yamlText);

    if (!Array.isArray(parsed)) {
      throw new Error("Format YAML invalide: une liste de monstres est attendue.");
    }

    allMonsters = parsed.filter((monster) => !isEasterEgg(monster));
    renderScrollingMonsterMenu(allMonsters);

    if (searchInput) {
      searchInput.addEventListener("input", handleSearchInput);
      searchInput.addEventListener("focus", handleSearchInput);
      searchInput.addEventListener("click", showAllSuggestions);
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && lastFilteredMonsters.length) {
          event.preventDefault();
          selectMonster(lastFilteredMonsters[0]);
        }
      });
    }

    document.addEventListener("click", (event) => {
      if (!searchResultsNode || !searchInput) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!searchResultsNode.contains(target) && target !== searchInput) {
        closeSearchResults();
      }
    });

  } catch (error) {
    console.error("Erreur de chargement:", error.message);
  }
}

init();
