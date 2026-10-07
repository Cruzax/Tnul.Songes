export const PATHS = {
  monsterImages: "assets/images/monsters",
  monsters: "data/monsters.yaml",
  spells: "data/spells.json",
  events: "data/events.yaml",
};

// Vitesse de défilement du carrousel en pixels par seconde, identique en grand et en petit mode
// (≈ 168 px par monstre en 3 s)
export const SCROLL_SPEED_PX_PER_SEC = 55;

// Largeur d'un monstre + espace entre deux (Tailwind: w-[208px] + gap-4, et w-11 + gap-2).
// On ne mesure pas le DOM: Tailwind CDN applique ses classes après coup.
export const MENU_ITEM_PITCH_PX = { full: 224, compact: 52 };
