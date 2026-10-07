import { MENU_ITEM_PITCH_PX, SCROLL_SPEED_PX_PER_SEC } from "../config.js";
import { cleanDisplayText, shuffleList } from "../lib/text.js";
import { createInitialFallback, monsterImageUrl } from "../lib/images.js";

const track = document.querySelector(".moving-menu-track");

let isCompact = false;

// Grand format (accueil): carte plate avec portrait et nom dessous
const FULL_ITEM_CLASS =
  "flex h-[256px] w-[208px] flex-none flex-col gap-3 overflow-hidden rounded-lg border border-line bg-panel p-3 text-ink transition-colors hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
// Petit format (après sélection): simple icône
const COMPACT_ITEM_CLASS =
  "block h-11 w-11 flex-none overflow-hidden rounded-md border border-transparent bg-transparent p-[3px] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
const FULL_MEDIA_CLASS = "h-[176px] w-full flex-none overflow-hidden rounded bg-panel2";
const COMPACT_MEDIA_CLASS = "h-full w-full overflow-hidden rounded bg-transparent";
const FULL_LABEL_CLASS =
  "menu-monster-name-label flex min-h-10 w-full items-center justify-center text-center text-[13px] leading-[18px] text-ink";
const COMPACT_LABEL_CLASS = "menu-monster-name-label hidden";
const FALLBACK_CLASS =
  "grid h-full w-full place-items-center bg-panel2 text-[0.95rem] text-muted";

let activeId = null;

function applyActive() {
  track?.querySelectorAll("button").forEach((item) => {
    const active = isCompact && activeId !== null && item.dataset.id === String(activeId);
    item.classList.toggle("menu-item-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
}

function updateAppearance() {
  if (!track) {
    return;
  }

  // pr = gap: la 2e moitié de la liste doublée recolle exactement au tour précédent (boucle sans saut)
  track.className = [
    "moving-menu-track",
    "flex w-max items-start whitespace-nowrap",
    isCompact ? "gap-2 py-2 pr-2" : "gap-4 py-1 pr-4",
  ].join(" ");

  track.querySelectorAll("button").forEach((item) => {
    item.className = isCompact ? COMPACT_ITEM_CLASS : FULL_ITEM_CLASS;
    const media = item.querySelector(".menu-monster-media");
    if (media) {
      media.className = `menu-monster-media ${isCompact ? COMPACT_MEDIA_CLASS : FULL_MEDIA_CLASS}`;
    }
    const label = item.querySelector(".menu-monster-name-label");
    if (label) {
      label.className = isCompact ? COMPACT_LABEL_CLASS : FULL_LABEL_CLASS;
    }
  });
  applyActive();
}

// Recalcule la durée du tour complet pour garder la même vitesse, sans saut visuel
function updateScrollSpeed() {
  const animation = track?._scrollAnimation;
  if (!animation) {
    return;
  }

  const monsterCount = track.querySelectorAll("button").length / 2;
  const pitch = isCompact ? MENU_ITEM_PITCH_PX.compact : MENU_ITEM_PITCH_PX.full;
  const distance = monsterCount * pitch;
  if (!distance) {
    return;
  }

  const newDuration = (distance / SCROLL_SPEED_PX_PER_SEC) * 1000;
  const oldDuration = animation.effect.getTiming().duration;
  const progress = oldDuration ? ((animation.currentTime || 0) % oldDuration) / oldDuration : 0;

  animation.effect.updateTiming({ duration: newDuration });
  animation.currentTime = progress * newDuration;
}

// Mode compact: une fois un boss choisi, le carrousel devient une rangée de petites icônes
export function setCompactMode(compact) {
  isCompact = compact;
  document.body.classList.toggle("menu-compact", compact);
  updateAppearance();
  updateScrollSpeed();
}

// Surligne le monstre affiché dans la rangée compacte
export function setActiveMonster(id) {
  activeId = id;
  applyActive();
}

function buildItem(monster, isDuplicate, onSelect) {
  const name = cleanDisplayText(monster.Name || "Monstre");

  const item = document.createElement("button");
  item.type = "button";
  item.className = isCompact ? COMPACT_ITEM_CLASS : FULL_ITEM_CLASS;
  item.title = name;
  item.dataset.id = String(monster.Id);
  item.addEventListener("click", () => onSelect(monster));

  const media = document.createElement("div");
  media.className = `menu-monster-media ${isCompact ? COMPACT_MEDIA_CLASS : FULL_MEDIA_CLASS}`;

  const showFallback = () => {
    media.innerHTML = "";
    media.appendChild(createInitialFallback(name, FALLBACK_CLASS));
  };

  if (monster.Image) {
    const image = document.createElement("img");
    image.className = "block h-full w-full object-contain p-1";
    image.loading = "lazy";
    image.alt = name;
    image.src = monsterImageUrl(monster.Image);
    image.addEventListener("error", showFallback);
    media.appendChild(image);
  } else {
    showFallback();
  }

  const label = document.createElement("span");
  label.className = isCompact ? COMPACT_LABEL_CLASS : FULL_LABEL_CLASS;
  label.textContent = name;

  item.append(media, label);

  // La liste est doublée pour une boucle sans coupure: la 2e moitié est cachée aux lecteurs d'écran
  if (isDuplicate) {
    item.setAttribute("aria-hidden", "true");
    item.tabIndex = -1;
  }
  return item;
}

function bindPauseOnHover(menuNode) {
  if (!menuNode || menuNode.dataset.scrollBound) {
    return;
  }
  menuNode.dataset.scrollBound = "1";
  const pause = () => track._scrollAnimation?.pause();
  const play = () => track._scrollAnimation?.play();
  menuNode.addEventListener("mouseenter", pause);
  menuNode.addEventListener("mouseleave", play);
  menuNode.addEventListener("focusin", pause);
  menuNode.addEventListener("focusout", play);
}

export function renderCarousel(monsters, onSelect) {
  if (!track) {
    return;
  }

  updateAppearance();

  const shuffled = shuffleList(monsters);
  if (!shuffled.length) {
    track.innerHTML = "<span>Aucun monstre charge</span>";
    return;
  }

  track.innerHTML = "";
  [...shuffled, ...shuffled].forEach((monster, index) => {
    track.appendChild(buildItem(monster, index >= shuffled.length, onSelect));
  });

  track._scrollAnimation?.cancel();
  track._scrollAnimation = track.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
    // Durée provisoire: updateScrollSpeed() la recalcule juste après
    { duration: 190000, iterations: Infinity, easing: "linear" }
  );
  updateScrollSpeed();
  bindPauseOnHover(track.parentElement);
}
