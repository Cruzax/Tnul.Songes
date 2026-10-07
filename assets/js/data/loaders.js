import { PATHS } from "../config.js";
import { normalizeText } from "../lib/text.js";

function isEasterEgg(monster) {
  const name = normalizeText(monster?.Name || "");
  return Number(monster?.Id) >= 3000000 || name === "crocus";
}

function isAvailableNow(monster, activeEvents) {
  if (!monster?.Event || !activeEvents) {
    return true;
  }
  return activeEvents.has(String(monster.Event));
}

// Événements en cours d'après data/events.yaml (null si le fichier est illisible: on affiche tout).
// ?events=halloween,nowel force des événements pour les tests.
async function loadActiveEvents() {
  try {
    const response = await fetch(PATHS.events);
    if (!response.ok) {
      return null;
    }

    const events = window.jsyaml.load(await response.text()) || {};
    const today = new Date().toISOString().slice(0, 10);
    const forced = (new URLSearchParams(window.location.search).get("events") || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    return new Set(
      Object.entries(events)
        .filter(([key, event]) => {
          const start = String(event?.Start || "");
          const end = String(event?.End || "");
          return forced.includes(key) || (start && end && today >= start && today <= end);
        })
        .map(([key]) => key)
    );
  } catch (error) {
    console.warn("Événements illisibles:", error.message);
    return null;
  }
}

export async function loadMonsters() {
  if (!window.jsyaml) {
    throw new Error("La librairie js-yaml n'est pas chargee.");
  }

  const response = await fetch(PATHS.monsters);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const parsed = window.jsyaml.load(await response.text());
  if (!Array.isArray(parsed)) {
    throw new Error("Format YAML invalide: une liste de monstres est attendue.");
  }

  const activeEvents = await loadActiveEvents();
  return parsed.filter((monster) => !isEasterEgg(monster) && isAvailableNow(monster, activeEvents));
}

// Les sorts sont facultatifs: sans eux, le simulateur est simplement masqué
export async function loadSpells() {
  try {
    const response = await fetch(PATHS.spells);
    return response.ok ? await response.json() : {};
  } catch (error) {
    return {};
  }
}
