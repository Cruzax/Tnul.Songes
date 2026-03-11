const searchInput = document.getElementById("monster-search");
const searchResultsNode = document.getElementById("search-results");
const movingMenuTrack = document.querySelector(".moving-menu-track");
const monsterDetailNode = document.getElementById("monster-detail");
const pageContainerNode = document.getElementById("page-container");
const siteFooterNode = document.getElementById("site-footer");

let allMonsters = [];
let lastFilteredMonsters = [];
let prefersShortInfo = false;
let isCompactMenu = false;

function updateScrollingMenuAppearance() {
  if (!movingMenuTrack) {
    return;
  }

  movingMenuTrack.className = [
    "moving-menu-track",
    "flex w-max items-center whitespace-nowrap",
    isCompactMenu ? "gap-2 p-2" : "gap-3 p-3"
  ].join(" ");

  const items = movingMenuTrack.querySelectorAll("button");
  items.forEach((item) => {
    item.className = isCompactMenu
      ? "block h-11 w-11 flex-none overflow-hidden rounded-xl border border-transparent bg-transparent p-0 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
      : "grid w-[156px] min-h-[148px] flex-none grid-rows-[100px_auto] items-center gap-1.5 overflow-hidden rounded-[14px] border border-transparent bg-transparent px-1.5 pb-1.5 pt-1.5 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";

    const nameLabel = item.querySelector(".menu-monster-name-label");
    if (nameLabel) {
      nameLabel.className = isCompactMenu
        ? "menu-monster-name-label hidden"
        : "menu-monster-name-label block w-full text-center text-[0.75rem] leading-[1.2] text-slate-100";
    }
  });
}

function setCompactMode(isCompact) {
  isCompactMenu = isCompact;
  document.body.classList.toggle("menu-compact", isCompact);

  if (siteFooterNode) {
    siteFooterNode.classList.toggle("hidden", !isCompact);
  }

  if (pageContainerNode) {
    pageContainerNode.classList.toggle("pb-8", !isCompact);
    pageContainerNode.classList.toggle("pb-40", isCompact);
  }

  updateScrollingMenuAppearance();
}

function playDetailTransition(targetNode) {
  if (!targetNode) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targetNode.classList.remove("animate-detail-grid-in");
    return;
  }

  targetNode.classList.remove("animate-detail-grid-in");
  // Force reflow so the same animation can replay on each monster switch.
  void targetNode.offsetWidth;
  targetNode.classList.add("animate-detail-grid-in");
}

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

function cleanSectionText(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function appendLineContentWithLinks(container, line) {
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

  if (hasLink) {
    const after = rawLine.slice(lastIndex);
    if (after) {
      container.appendChild(document.createTextNode(cleanDisplayText(after)));
    }
    return;
  }

  container.textContent = cleanDisplayText(rawLine);
}

function buildImagePath(basePath, fileName) {
  return `${basePath}/${encodeURIComponent(String(fileName || ""))}`;
}

function createStatChip(label, value) {
  const row = document.createElement("div");
  row.className = "grid grid-cols-[112px_1fr_28px] items-center gap-2";

  const name = document.createElement("span");
  name.className = "text-[0.85rem] text-slate-200";
  name.textContent = label;

  const bar = document.createElement("div");
  bar.className = "h-[9px] overflow-hidden rounded-full bg-white/15";

  const fill = document.createElement("span");
  fill.className = "block h-full rounded-full bg-[linear-gradient(90deg,#76d1ff_0%,#93f0bb_45%,#ffd36f_75%,#ff8f8f_100%)]";
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamped = Math.max(0, Math.min(10, numericValue));
  fill.style.width = `${clamped * 10}%`;

  const valueText = document.createElement("span");
  valueText.className = "text-right text-[0.82rem] text-slate-100";
  valueText.textContent = String(value ?? "-");

  bar.appendChild(fill);
  row.append(name, bar, valueText);
  return row;
}

function renderScrollingMonsterMenu(monsters) {
  if (!movingMenuTrack) {
    return;
  }

  updateScrollingMenuAppearance();

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
    item.className = isCompactMenu
      ? "block h-11 w-11 flex-none overflow-hidden rounded-xl border border-transparent bg-transparent p-0 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
      : "grid w-[156px] min-h-[148px] flex-none grid-rows-[100px_auto] items-center gap-1.5 overflow-hidden rounded-[14px] border border-transparent bg-transparent px-1.5 pb-1.5 pt-1.5 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
    item.title = cleanDisplayText(monster.Name || "Monstre");
    item.addEventListener("click", () => selectMonster(monster));

    const media = document.createElement("div");
    media.className = "h-full w-full overflow-hidden rounded-[10px] bg-transparent";

    const image = document.createElement("img");
    image.className = "block h-full w-full object-contain";
    image.loading = "lazy";
    image.alt = cleanDisplayText(monster.Name || "Monstre");

    const nameLabel = document.createElement("span");
    nameLabel.className = isCompactMenu
      ? "menu-monster-name-label hidden"
      : "menu-monster-name-label block w-full text-center text-[0.75rem] leading-[1.2] text-slate-100";
    nameLabel.textContent = cleanDisplayText(monster.Name || "Monstre");

    const fallback = document.createElement("div");
    fallback.className = "grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgba(139,197,255,0.35),rgba(112,138,188,0.35))] text-[0.95rem] text-slate-100";
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

  if (movingMenuTrack._scrollAnimation) {
    movingMenuTrack._scrollAnimation.cancel();
  }

  const scrollAnimation = movingMenuTrack.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-50%)" }
    ],
    {
      duration: 190000,
      iterations: Infinity,
      easing: "linear"
    }
  );

  movingMenuTrack._scrollAnimation = scrollAnimation;

  const menuNode = movingMenuTrack.parentElement;
  if (menuNode && !menuNode.dataset.scrollBound) {
    menuNode.dataset.scrollBound = "1";
    menuNode.addEventListener("mouseenter", () => {
      movingMenuTrack._scrollAnimation?.pause();
    });
    menuNode.addEventListener("mouseleave", () => {
      movingMenuTrack._scrollAnimation?.play();
    });
    menuNode.addEventListener("focusin", () => {
      movingMenuTrack._scrollAnimation?.pause();
    });
    menuNode.addEventListener("focusout", () => {
      movingMenuTrack._scrollAnimation?.play();
    });
  }
}

function closeSearchResults() {
  if (!searchResultsNode) {
    return;
  }
  searchResultsNode.hidden = true;
  searchResultsNode.innerHTML = "";
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

  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const mostlyBullets = bulletLines.length >= 2 && bulletLines.length >= Math.ceil(lines.length / 2);

  if (mostlyBullets) {
    const list = document.createElement("ul");
    list.className = "m-0 grid list-disc gap-1.5 pl-5";

    lines.forEach((line) => {
      const item = document.createElement("li");
      item.className = "leading-6 text-slate-100";
      appendLineContentWithLinks(item, line);
      list.appendChild(item);
    });

    block.append(heading, list);
  } else {
    const textWrap = document.createElement("div");
    textWrap.className = "space-y-2";

    lines.forEach((line) => {
      const text = document.createElement("p");
      text.className = "m-0 leading-6 text-slate-100";
      appendLineContentWithLinks(text, line);
      textWrap.appendChild(text);
    });

    block.append(heading, textWrap);
  }

  container.appendChild(block);
}

function getShortInfoSections(monster) {
  const sections = [];
  const info = cleanSectionText(monster?.InformationShort || "");
  const advice = cleanSectionText(monster?.AdviceShort || "");
  const mechanic = cleanSectionText(monster?.MechanicShort || "");

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
  const info = cleanSectionText(monster?.Information || "");
  const advice = cleanSectionText(monster?.Advice || "");
  const mechanic = cleanSectionText(monster?.Mechanic || "");

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
  container.className = "w-full";

  if (!monster.Image) {
    const fallback = document.createElement("div");
    fallback.className = "grid min-h-[120px] w-full place-items-center rounded-xl border border-slate-200/35 bg-white/10 text-sm text-slate-300";
    fallback.textContent = "Image introuvable";
    container.appendChild(fallback);
    return;
  }

  const image = document.createElement("img");
  image.className = "min-h-[120px] w-full rounded-xl border border-slate-200/35 bg-slate-950/45 object-contain";
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
    fallback.className = "grid min-h-[120px] w-full place-items-center rounded-xl border border-slate-200/35 bg-white/10 text-sm text-slate-300";
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
  head.className = "grid items-start gap-3.5 md:grid-cols-[140px_1fr]";

  const media = document.createElement("div");
  renderDetailImage(media, monster);

  const info = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "m-0 text-2xl text-slate-100";
  title.textContent = cleanDisplayText(monster.Name || "Monstre sans nom");

  const stats = document.createElement("div");
  stats.className = "grid max-w-[360px] gap-2";
  stats.append(
    createStatChip("Difficulte", monster.Difficulty),
    createStatChip("Focus immediat", monster.ImmediateFocus),
    createStatChip("Evasion", monster.Evasion),
    createStatChip("Tanking", monster.Tanking)
  );

  const shortInfoButton = document.createElement("button");
  shortInfoButton.type = "button";
  shortInfoButton.className = "mt-3 flex w-full max-w-[260px] items-center justify-between gap-2 rounded-xl border border-sky-300/40 bg-white/10 px-2.5 py-2 text-slate-100 transition-colors hover:border-sky-300/70 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
  shortInfoButton.setAttribute("aria-label", "Activer Information courte si possible");
  const shortSections = getShortInfoSections(monster);
  const longSections = getLongInfoSections(monster);
  const hasShortInfo = shortSections.length > 0;
  const isShortMode = hasShortInfo ? showShort : false;

  const toggleText = document.createElement("span");
  toggleText.className = "grid text-left leading-[1.1]";

  const toggleTitle = document.createElement("span");
  toggleTitle.className = "text-[0.86rem] font-semibold";
  toggleTitle.textContent = "Information courte";

  const toggleHint = document.createElement("span");
  toggleHint.className = "text-[0.72rem] text-slate-300";
  toggleHint.textContent = "si possible";

  const toggleTrack = document.createElement("span");
  toggleTrack.className = "relative h-6 w-[42px] flex-none rounded-full bg-slate-400/50 transition-colors";

  const toggleKnob = document.createElement("span");
  toggleKnob.className = "absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform";

  toggleTrack.appendChild(toggleKnob);
  toggleText.append(toggleTitle, toggleHint);
  shortInfoButton.append(toggleText, toggleTrack);

  shortInfoButton.setAttribute("aria-pressed", isShortMode ? "true" : "false");
  toggleTrack.classList.toggle("bg-emerald-500", isShortMode);
  toggleKnob.classList.toggle("translate-x-[18px]", isShortMode);
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
  grid.className = "mt-4 grid gap-2.5";

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
  playDetailTransition(grid);
}

function selectMonster(monster) {
  if (!monster) {
    return;
  }

  setCompactMode(true);

  if (searchInput) {
    searchInput.value = cleanDisplayText(monster.Name || "");
  }

  renderMonsterDetail(monster, prefersShortInfo);
  closeSearchResults();
}

function buildSearchResultItem(monster) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "w-full rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left text-slate-100 transition-colors hover:bg-sky-300/25";
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
    empty.className = "m-0 px-2.5 py-2 text-[0.92rem] text-slate-300";
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
    setCompactMode(false);
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
