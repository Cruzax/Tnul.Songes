import { PATHS } from "../config.js";

export function monsterImageUrl(fileName) {
  return `${PATHS.monsterImages}/${encodeURIComponent(String(fileName || ""))}`;
}

// Pastille avec l'initiale, utilisée quand un monstre n'a pas d'image
export function createInitialFallback(label, className, tag = "div") {
  const fallback = document.createElement(tag);
  fallback.className = className;
  fallback.textContent = (label.charAt(0) || "M").toUpperCase();
  return fallback;
}
