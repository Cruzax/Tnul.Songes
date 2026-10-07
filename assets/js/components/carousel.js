import { MENU_ITEM_PITCH_PX, SCROLL_SPEED_PX_PER_SEC } from "../config.js";
import { cleanDisplayText, shuffleList } from "../lib/text.js";
import { createInitialFallback, monsterImageUrl } from "../lib/images.js";

const track = document.querySelector(".moving-menu-track");
const pageContainer = document.getElementById("page-container");
const siteFooter = document.getElementById("site-footer");

let isCompact = false;

const FULL_ITEM_CLASS =
  "grid w-[156px] min-h-[148px] flex-none grid-rows-[100px_auto] items-center gap-1.5 overflow-hidden rounded-[14px] border border-transparent bg-transparent px-1.5 pb-1.5 pt-1.5 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
const COMPACT_ITEM_CLASS =
  "block h-11 w-11 flex-none overflow-hidden rounded-xl border border-transparent bg-transparent p-0 transition-colors hover:border-sky-300/70 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
const FULL_LABEL_CLASS =
  "menu-monster-name-label block w-full text-center text-[0.75rem] leading-[1.2] text-slate-100";
const COMPACT_LABEL_CLASS = "menu-monster-name-label hidden";
const FALLBACK_CLASS =
  "grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgba(139,197,255,0.35),rgba(112,138,188,0.35))] text-[0.95rem] text-slate-100";

function updateAppearance() {
  if (!track) {
    return;
  }

  track.className = [
    "moving-menu-track",
    "flex w-max items-center whitespace-nowrap",
    isCompact ? "gap-2 p-2" : "gap-3 p-3",
  ].join(" ");

  track.querySelectorAll("button").forEach((item) => {
    item.className = isCompact ? COMPACT_ITEM_CLASS : FULL_ITEM_CLASS;
    const label = item.querySelector(".menu-monster-name-label");
    if (label) {
      label.className = isCompact ? COMPACT_LABEL_CLASS : FULL_LABEL_CLASS;
    }
  });
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
  siteFooter?.classList.toggle("hidden", !compact);
  pageContainer?.classList.toggle("pb-8", !compact);
  pageContainer?.classList.toggle("pb-40", compact);

  updateAppearance();
  updateScrollSpeed();
}

function buildItem(monster, isDuplicate, onSelect) {
  const name = cleanDisplayText(monster.Name || "Monstre");

  const item = document.createElement("button");
  item.type = "button";
  item.className = isCompact ? COMPACT_ITEM_CLASS : FULL_ITEM_CLASS;
  item.title = name;
  item.addEventListener("click", () => onSelect(monster));

  const media = document.createElement("div");
  media.className = "h-full w-full overflow-hidden rounded-[10px] bg-transparent";

  const showFallback = () => {
    media.innerHTML = "";
    media.appendChild(createInitialFallback(name, FALLBACK_CLASS));
  };

  if (monster.Image) {
    const image = document.createElement("img");
    image.className = "block h-full w-full object-contain";
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
