import { loadMonsters, loadSpells } from "./data/loaders.js";
import { renderCarousel, setActiveMonster, setCompactMode } from "./components/carousel.js";
import { closeSearchResults, initSearch, setSearchValue } from "./components/search.js";
import { renderMonsterDetail, setSpellsData } from "./components/detail.js";
import { cleanDisplayText } from "./lib/text.js";

function selectMonster(monster) {
  if (!monster) {
    return;
  }
  setCompactMode(true);
  setActiveMonster(monster.Id);
  setSearchValue(cleanDisplayText(monster.Name || ""));
  renderMonsterDetail(monster);
  closeSearchResults();
}

const LOADING_MIN_MS = 1200;

async function init() {
  const started = performance.now();
  try {
    const [monsters, spells] = await Promise.all([loadMonsters(), loadSpells()]);
    setSpellsData(spells);
    setCompactMode(false);
    renderCarousel(monsters, selectMonster);
    initSearch(monsters, selectMonster);
  } catch (error) {
    console.error("Erreur de chargement:", error.message);
  } finally {
    const wait = document.documentElement.classList.contains("intro-seen") ? 0 : LOADING_MIN_MS - (performance.now() - started);
    setTimeout(hideLoadingScreen, Math.max(0, wait));
  }
}

function hideLoadingScreen() {
  const screen = document.getElementById("loading-screen");
  if (!screen) {
    return;
  }
  screen.classList.add("done");
  setTimeout(() => screen.remove(), 1000);
}

init();
