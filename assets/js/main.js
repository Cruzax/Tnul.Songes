import { loadMonsters, loadSpells } from "./data/loaders.js";
import { renderCarousel, setCompactMode } from "./components/carousel.js";
import { closeSearchResults, initSearch, setSearchValue } from "./components/search.js";
import { renderMonsterDetail, setSpellsData } from "./components/detail.js";
import { cleanDisplayText } from "./lib/text.js";

function selectMonster(monster) {
  if (!monster) {
    return;
  }
  setCompactMode(true);
  setSearchValue(cleanDisplayText(monster.Name || ""));
  renderMonsterDetail(monster);
  closeSearchResults();
}

async function init() {
  try {
    const [monsters, spells] = await Promise.all([loadMonsters(), loadSpells()]);
    setSpellsData(spells);
    setCompactMode(false);
    renderCarousel(monsters, selectMonster);
    initSearch(monsters, selectMonster);
  } catch (error) {
    console.error("Erreur de chargement:", error.message);
  }
}

init();
