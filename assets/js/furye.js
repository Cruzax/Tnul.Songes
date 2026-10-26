// Page « Furye »: planificateur de défense (grille 5 lignes x 10 colonnes, données dans data/furye.json).
// Pas de solveur: les vagues ne sont pas connues. La page compte les PA par tour (4 + 1 par Kelpe) et les dégâts
// de chaque ligne, et les compare aux PV des monstres de Furye.
(async function () {
  const STORAGE_KEY = "tnul-furye";
  const grid = document.getElementById("fy-grid");
  let data;
  try {
    data = await fetch("data/furye.json").then((response) => response.json());
  } catch (error) {
    grid.textContent = "Impossible de charger le combat.";
    console.error("Erreur de chargement:", error.message);
    return;
  }
  const units = new Map(data.units.map((u) => [u.id, u]));
  const icon = (id) => `assets/images/spells/sort_${id}.png`;

  // board[ligne][colonne] = { id, up } ou null
  const empty = () => Array.from({ length: data.lanes }, () => Array(data.columns).fill(null));
  let board = empty();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length === data.lanes) board = saved;
  } catch (error) {
    // stockage indisponible
  }
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch (error) {
      // sans importance
    }
  };
  let tool = "kelpe";

  function badge(unit, up) {
    const node = document.createElement("span");
    node.className = `fy-unit unit-${unit.id}${up ? " up" : ""}`;
    if (unit.icon) {
      const img = document.createElement("img");
      img.src = icon(unit.icon);
      img.alt = "";
      node.appendChild(img);
    } else {
      node.appendChild(document.createElement("i"));
    }
    return node;
  }

  function render() {
    grid.textContent = "";
    grid.style.setProperty("--cols", data.columns);
    for (let lane = 0; lane < data.lanes; lane++) {
      for (let col = 0; col < data.columns; col++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "fy-cell";
        const here = board[lane][col];
        if (here) {
          const unit = units.get(here.id);
          cell.appendChild(badge(unit, here.up));
          cell.title = `${unit.name}${here.up ? " amélioré" : ""} (${here.up ? unit.hpUp : unit.hp} PV)`;
          cell.setAttribute("aria-label", cell.title);
        } else {
          cell.setAttribute("aria-label", `Ligne ${lane + 1}, colonne ${col + 1}, vide`);
        }
        cell.addEventListener("click", () => {
          const current = board[lane][col];
          if (current && current.id === tool && tool !== "globe") current.up = !current.up;
          else board[lane][col] = { id: tool, up: false };
          save();
          render();
        });
        cell.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          board[lane][col] = null;
          save();
          render();
        });
        grid.appendChild(cell);
      }
      const side = document.createElement("span");
      side.className = "fy-enemy-side";
      side.textContent = "◀";
      side.setAttribute("aria-hidden", "true");
      grid.appendChild(side);
    }
    stats();
  }

  // Bilan: PA, dégâts par ligne, tours pour tuer une Osseuse (200 PV), conseils manquants
  function stats() {
    const all = board.flat().filter(Boolean);
    const count = (id) => all.filter((u) => u.id === id).length;
    const pa = data.pa + count("kelpe");
    const lines = board.map((row) => row.reduce((n, u) => n + (u && units.get(u.id).damage ? (u.up ? units.get(u.id).damageUp : units.get(u.id).damage) : 0), 0));
    const blockers = board.map((row) => row.filter((u) => u && u.id !== "globe").length);
    const statsNode = document.getElementById("fy-stats");
    statsNode.innerHTML = "";
    [["PA par tour", pa], ["Kelpe", count("kelpe")], ["Verak", count("verak")], ["Globes", count("globe")]].forEach(([k, v]) => {
      const box = document.createElement("div");
      box.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
      statsNode.appendChild(box);
    });
    const big = data.enemies[data.enemies.length - 1];
    const lanesNode = document.getElementById("fy-lanes");
    lanesNode.textContent = "";
    lines.forEach((damage, lane) => {
      const item = document.createElement("li");
      const turns = damage ? Math.ceil(big.hp / damage) : null;
      item.className = damage >= 20 ? "good" : damage ? "weak" : "none";
      item.textContent = `Ligne ${lane + 1} : ${damage} dégâts/tour${turns ? ` · ${big.name} tuée en ${turns} tours` : " · aucune frappe"} · ${blockers[lane]} invocation${blockers[lane] > 1 ? "s" : ""}`;
      lanesNode.appendChild(item);
    });
    const tips = [];
    if (count("kelpe") < 3) tips.push("Il faut toujours au moins 3 Kelpe.");
    if (lines.some((d) => d === 0)) tips.push("Une ligne sans Cyanog ni Goémus laisse passer les monstres.");
    if (blockers.some((n) => n < 4)) tips.push("Pour bloquer Furye au tour 31, vise 4 invocations par ligne.");
    if (count("globe") < data.lanes) tips.push("Place les 5 globes (un par ligne) pour voir ta défense complète.");
    document.getElementById("fy-advice").textContent = tips.length ? tips.join(" ") : "Défense complète : 4 lignes d'invocations et une frappe sur chaque ligne.";
  }

  const toolbar = document.getElementById("fy-tools");
  data.units.forEach((unit) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sf-tool fy-tool";
    button.appendChild(badge(unit, false));
    button.append(unit.name);
    button.title = unit.role;
    button.setAttribute("aria-pressed", String(unit.id === tool));
    button.addEventListener("click", () => {
      tool = unit.id;
      toolbar.querySelectorAll(".fy-tool").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
    toolbar.appendChild(button);
  });

  document.getElementById("fy-preset").addEventListener("click", () => {
    board = empty();
    Object.entries(data.preset.columns).forEach(([col, id]) => {
      for (let lane = 0; lane < data.lanes; lane++) board[lane][Number(col)] = { id, up: id === "verak" || id === "cyanog" };
    });
    save();
    render();
  });
  document.getElementById("fy-clear").addEventListener("click", () => {
    board = empty();
    save();
    render();
  });

  const timeline = document.getElementById("fy-timeline");
  data.timeline.forEach((step) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="fy-turn">Tour ${step.turn}</span>`;
    item.append(step.text);
    timeline.appendChild(item);
  });
  const spells = document.getElementById("fy-spells");
  [...data.units.filter((u) => u.icon), ...data.spells].forEach((s) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong class="spell-name"><img class="spell-ic" src="${icon(s.icon)}" alt="" width="20" height="20" loading="lazy"></strong>`;
    item.firstChild.append(s.name);
    const hp = s.hp ? ` (${s.hp} PV, ${s.hpUp} amélioré)` : "";
    item.append(`${hp} : ${s.role || s.text}`);
    spells.appendChild(item);
  });
  document.getElementById("fy-enemies").textContent = `Monstres de Furye : ${data.enemies.map((e) => `${e.name} ${e.hp} PV`).join(", ")}. Furye reste invulnérable jusqu'à Larme du Destin.`;

  render();
})();
