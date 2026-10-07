(function (root) {
  const G = root.TnulGrid;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const A = 20; // demi-largeur d'une case
  const B = 8; // demi-hauteur d'une case (plus plat que 2:1)
  const WALL_HEIGHT = 10;
  const SLAB = 9; // épaisseur du socle sous la carte
  const MAX_ALLIES = 8;

  function svg(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  const keyOf = (cell) => `${cell.u},${cell.v}`;

  // Enveloppe convexe (chaîne monotone d'Andrew)
  function convexHull(points) {
    const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    pts.forEach((p) => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    });
    const upper = [];
    [...pts].reverse().forEach((p) => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  function center(cell) {
    const { px, py } = G.toScreen(cell.u, cell.v);
    return { x: (px + 1) * A, y: (py + 1) * B };
  }

  function spellLabel(spell) {
    const po = spell.poMin === spell.poMax ? `${spell.poMax} PO` : `${spell.poMin}-${spell.poMax} PO`;
    const extras = [spell.line ? "ligne" : null, spell.diagonal ? "diagonale" : null, spell.los ? null : "sans LDV"]
      .filter(Boolean);
    return { title: spell.name, detail: [`${spell.pa} PA`, po, ...extras].join(" · ") };
  }

  function mount(container, options) {
    const { imageUrls, data } = options;
    const maps = options.maps || [];
    const DEFAULT_BOSS = { u: 17, v: -3 };
    const initialMap = options.noEmptyOption && maps.length ? 0 : -1;
    const viewOnly = Boolean(options.viewOnly);
    const allyImage = options.allyImage || "assets/allies/ouginak.png";
    const state = {
      boss: { u: 17, v: -3 },
      allies: [],
      walls: new Set(),
      mask: null, // Set des cases existantes (null = grille complète)
      starts: false,
      startAlly: new Set(),
      startEnemy: new Set(),
      spell: null,
      hover: null,
      drag: false,
    };
    const cache = { range: new Set(), visible: null };
    const hare = { on: false, bracket: 0, melee: 0, player: null, target: null, visible: null };
    const HARE_BRACKETS = [
      { label: "100% - 90%", angle: 90 },
      { label: "89% - 75%", angle: 270 },
      { label: "74% - 45%", angle: 180 },
      { label: "44% - 30%", angle: 270 },
      { label: "29% - 0%", angle: 90 },
    ];

    container.innerHTML = "";
    const section = document.createElement("section");
    section.className = "sim-section";
    section.innerHTML = `
      <div class="sim-header">
        <h2 class="sim-title">Simulation</h2>
        <div class="sim-tools">
          ${maps.length ? '<select class="sim-map" aria-label="Carte">' + (options.noEmptyOption ? "" : '<option value="-1">Grille vide</option>') + maps.map((m, i) => `<option value="${i}">${m.name}</option>`).join("") + "</select>" : ""}
          ${maps.length && !options.hideStartsToggle ? '<label class="sim-starts-label"><input type="checkbox" class="sim-starts"> Placements de départ</label>' : ""}
          ${options.harebourg ? '<label class="sim-hare-label"><input type="checkbox" class="sim-hare-toggle"> Mode Harebourg</label>' : ""}
          <button type="button" class="sim-copy" title="Copie les obstacles de la carte pour me les envoyer">Copier la carte</button>
          <button type="button" class="sim-reset">Réinitialiser</button>
        </div>
      </div>
      <div class="sim-hare-panel" hidden>
        <div class="sim-hare-hp">${HARE_BRACKETS.map((b, i) => `<button type="button" class="sim-hare-hp-btn" data-i="${i}" aria-pressed="${i === 0}">${b.label}</button>`).join("")}</div>
        <label class="sim-hare-melee">Coups en mêlée <input type="number" class="sim-hare-melee-input" min="0" max="12" value="0"></label>
        <p class="sim-hare-info"></p>
      </div>
      <p class="sim-hint">${viewOnly ? "Clic droit sur une case: poser ou retirer un obstacle (pour corriger la carte)." : "Glisse le boss. Clic gauche: poser ou retirer un allié. Clic droit: poser ou retirer un obstacle. Les cases sombres sont hors de la ligne de vue du boss."}</p>`;
    const spellList = document.createElement("div");
    spellList.className = "sim-spells";
    section.appendChild(spellList);

    const board = svg("svg", { viewBox: `0 0 ${(G.COLS * 2 + 1) * A} ${(G.ROWS + 1) * B + SLAB}`, class: "sim-board" });
    // Socle: une case décalée vers le bas par case existante (suit la forme réelle de la carte).
    const slab = svg("g", { class: "sim-slab-layer" });
    board.appendChild(slab);

    function updateSlab() {
      slab.innerHTML = "";
      G.allCells().forEach((cell) => {
        if (state.mask && !state.mask.has(keyOf(cell))) {
          return;
        }
        const { px, py } = G.toScreen(cell.u, cell.v);
        const cx = (px + 1) * A;
        const cy = (py + 1) * B + SLAB;
        slab.appendChild(svg("polygon", {
          points: `${cx - A},${cy} ${cx},${cy - B} ${cx + A},${cy} ${cx},${cy + B}`,
          class: "sim-slab",
        }));
      });
    }
    updateSlab();
    const cellNodes = new Map();
    G.allCells().forEach((cell) => {
      const { px, py } = G.toScreen(cell.u, cell.v);
      const cx = (px + 1) * A;
      const cy = (py + 1) * B;
      const polygon = svg("polygon", {
        points: `${cx - A},${cy} ${cx},${cy - B} ${cx + A},${cy} ${cx},${cy + B}`,
        class: `sim-cell${(px + py) % 4 === 0 ? " alt" : ""}`,
      });
      polygon.dataset.u = cell.u;
      polygon.dataset.v = cell.v;
      polygon._base = polygon.getAttribute("class");
      polygon._cls = polygon._base;
      board.appendChild(polygon);
      cellNodes.set(keyOf(cell), polygon);
    });

    const wallsLayer = svg("g", { class: "sim-walls" });
    board.appendChild(wallsLayer);

    const alliesLayer = svg("g", { class: "sim-allies" });
    board.appendChild(alliesLayer);

    // Le jeton du boss est créé une seule fois: on le déplace, on ne le recrée pas (pas de clignotement).
    const bossToken = svg("g", { class: "sim-boss-token" });
    const bossFallback = svg("circle", { cx: 0, cy: -6, r: 11, class: "sim-boss-fallback" });
    bossToken.appendChild(bossFallback);
    if (imageUrls && imageUrls.length) {
      const image = svg("image", { x: -22, y: -40, width: 44, height: 44 });
      let attempt = 0;
      image.setAttribute("href", imageUrls[attempt]);
      image.addEventListener("error", () => {
        attempt += 1;
        if (attempt < imageUrls.length) {
          image.setAttribute("href", imageUrls[attempt]);
        } else {
          image.remove();
        }
      });
      image.addEventListener("load", () => bossFallback.remove());
      bossToken.appendChild(image);
    }
    bossToken.addEventListener("pointerdown", (event) => {
      state.drag = true;
      board.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    bossToken.style.display = viewOnly ? "none" : "";
    board.appendChild(bossToken);

    if (viewOnly) {
      spellList.hidden = true;
    }
    section.appendChild(board);
    const detail = document.createElement("div");
    detail.className = "sim-detail";
    detail.hidden = viewOnly;
    section.appendChild(detail);
    container.appendChild(section);

    function cellFromPoint(event) {
      const node = state.drag ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
      if (node && node.dataset && node.dataset.u !== undefined) {
        return { u: Number(node.dataset.u), v: Number(node.dataset.v) };
      }
      return null;
    }

    const sameCell = (a, b) => Boolean(a && b && a.u === b.u && a.v === b.v);

    function drawWalls() {
      wallsLayer.innerHTML = "";
      const cells = [...state.walls].map((k) => {
        const [u, v] = k.split(",").map(Number);
        return { u, v };
      }).sort((a, b) => (a.u - a.v) - (b.u - b.v));
      cells.forEach((cell) => {
        const { x, y } = center(cell);
        const lift = (dy) => y - dy;
        wallsLayer.appendChild(svg("polygon", {
          points: `${x - A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B} ${x},${y + B} ${x - A},${y}`,
          class: "sim-wall-left",
        }));
        wallsLayer.appendChild(svg("polygon", {
          points: `${x + A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B} ${x},${y + B} ${x + A},${y}`,
          class: "sim-wall-right",
        }));
        wallsLayer.appendChild(svg("polygon", {
          points: `${x - A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) - B} ${x + A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B}`,
          class: "sim-wall-top",
        }));
      });
    }

    function drawAllies() {
      alliesLayer.innerHTML = "";
      [...state.allies].sort((a, b) => (a.u - a.v) - (b.u - b.v)).forEach((ally) => {
        const c = center(ally);
        alliesLayer.appendChild(svg("image", {
          href: allyImage, x: c.x - 22, y: c.y - 40, width: 44, height: 44, class: "sim-ally-sprite",
        }));
      });
    }

    function placeBoss() {
      const c = center(state.boss);
      bossToken.setAttribute("transform", `translate(${c.x} ${c.y})`);
    }

    const allowed = (cell) => !state.mask || state.mask.has(keyOf(cell));

    // --- Mode Harebourg: confusion horaire (le sort est redirigé de 90°, 180° ou 270°)
    const hareAngle = () => (HARE_BRACKETS[hare.bracket].angle + 90 * hare.melee) % 360;

    function hareAim() {
      if (!hare.player || !hare.target) {
        return null;
      }
      let du = hare.target.u - hare.player.u;
      let dv = hare.target.v - hare.player.v;
      for (let i = 0; i < hareAngle() / 90; i += 1) {
        [du, dv] = [-dv, du]; // quart de tour anti-horaire à l'écran
      }
      const cell = { u: hare.player.u + du, v: hare.player.v + dv };
      return G.isValid(cell.u, cell.v) && allowed(cell) && !state.walls.has(keyOf(cell)) ? cell : null;
    }

    function hareRefresh() {
      hare.visible = hare.player ? G.visibleKeys(hare.player, state.walls) : null;
      const info = section.querySelector(".sim-hare-info");
      if (!info) {
        return;
      }
      if (!hare.player || !hare.target) {
        info.textContent = "Clic gauche: ton perso. Clic droit: la case que tu veux toucher. La case blanche est celle à viser.";
      } else {
        info.textContent = `Confusion de ${hareAngle()}°. ${hareAim() ? "Vise la case blanche." : "Case à viser impossible (mur ou hors de la carte)."}`;
      }
    }

    // Recalculs lourds: seulement quand le boss, le sort ou les obstacles changent (pas au survol).
    function refreshRange() {
      cache.range = new Set();
      if (state.spell) {
        G.rangeCells(state.boss, state.spell, state.walls)
          .filter((c) => allowed(c))
          .forEach((c) => cache.range.add(keyOf(c)));
      }
    }

    function refreshVisibility() {
      cache.visible = G.visibleKeys(state.boss, state.walls);
    }

    function paintCells() {
      const zone = new Set();
      if (state.spell && state.hover && cache.range.has(keyOf(state.hover))) {
        G.zoneCells(state.hover, state.boss, state.spell.zone).forEach((c) => zone.add(keyOf(c)));
      }
      const allies = new Set(state.allies.map(keyOf));
      const hoverKey = state.hover ? keyOf(state.hover) : null;
      const showShade = hare.on ? Boolean(hare.visible && state.walls.size > 0) : !viewOnly && cache.visible && state.walls.size > 0;
      const visibleSet = hare.on ? hare.visible : cache.visible;
      const aim = hare.on ? hareAim() : null;
      const playerKey = hare.on && hare.player ? keyOf(hare.player) : null;
      const targetKey = hare.on && hare.target ? keyOf(hare.target) : null;
      const aimKey = aim ? keyOf(aim) : null;

      cellNodes.forEach((node, key) => {
        let cls = node._base;
        if (state.mask && !state.mask.has(key)) {
          cls += " void";
        } else if (showShade && !visibleSet.has(key)) {
          cls += " nolos";
        }
        if (state.starts && state.startEnemy.has(key)) {
          cls += " start-enemy";
        }
        if (state.starts && state.startAlly.has(key)) {
          cls += " start-ally";
        }
        if (cache.range.has(key)) {
          cls += " range";
        }
        if (zone.has(key)) {
          cls += " zone";
        }
        if (allies.has(key)) {
          cls += " ally";
        }
        if (key === playerKey) {
          cls += " hare-player";
        }
        if (key === targetKey) {
          cls += " hare-target";
        }
        if (key === aimKey) {
          cls += " hare-aim";
        }
        if (key === hoverKey) {
          cls += " hover";
        }
        if (cls !== node._cls) {
          node.setAttribute("class", cls);
          node._cls = cls;
        }
      });
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) {
        node.className = className;
      }
      if (text !== undefined) {
        node.textContent = text;
      }
      return node;
    }

    const fmt = (n) => n.toLocaleString("fr-FR");

    function effectList(effects) {
      const list = el("ul", "sim-effects");
      effects.forEach((effect) => {
        const item = el("li", "sim-effect");
        let line = effect.text;
        if (effect.duration) {
          line += ` · ${effect.duration} tour${effect.duration > 1 ? "s" : ""}`;
        }
        item.appendChild(el("span", "sim-effect-text", line));
        if (effect.est) {
          const label = effect.kind === "heal" ? "soin" : effect.kind === "steal" ? "vol de vie" : "dégâts";
          const range = effect.est[0] === effect.est[1]
            ? fmt(effect.est[0])
            : `${fmt(effect.est[0])} à ${fmt(effect.est[1])}`;
          item.appendChild(el("span", "sim-effect-est", `≈ ${range} ${label}`));
        }
        const notes = [];
        if (effect.target) {
          notes.push(`Cible: ${effect.target.replace(/#1/g, "un état")}`);
        }
        if (effect.except) {
          notes.push(`Sauf: ${effect.except.replace(/#1/g, "un état")}`);
        }
        if (effect.when) {
          notes.push(`Déclenché: ${effect.when}`);
        }
        if (notes.length) {
          item.appendChild(el("span", "sim-effect-note", notes.join(" — ")));
        }
        list.appendChild(item);
      });
      return list;
    }

    function renderDetail(spell) {
      detail.innerHTML = "";
      if (!spell) {
        detail.appendChild(el("p", "sim-detail-empty", "Choisis un sort pour voir son détail complet."));
        return;
      }

      const head = el("div", "sim-detail-head");
      if (spell.icon) {
        const icon = el("img", "sim-spell-icon");
        icon.src = `assets/spells/sort_${spell.icon}.png`;
        icon.alt = "";
        icon.addEventListener("error", () => icon.remove());
        head.appendChild(icon);
      }
      head.appendChild(el("h3", "sim-detail-title", spell.name));
      detail.appendChild(head);

      const meta = [
        `${spell.pa} PA`,
        spell.poMin === spell.poMax ? `${spell.poMax} PO` : `${spell.poMin} à ${spell.poMax} PO`,
        spell.poModifiable ? "PO modifiable" : null,
        spell.line ? "lancer en ligne" : null,
        spell.diagonal ? "lancer en diagonale" : null,
        spell.los ? "ligne de vue requise" : "sans ligne de vue",
        spell.cooldown ? `relance ${spell.cooldown} tour${spell.cooldown > 1 ? "s" : ""}` : null,
        spell.initialCooldown ? `disponible au tour ${spell.initialCooldown + 1}` : null,
        spell.maxPerTurn ? `${spell.maxPerTurn}/tour` : null,
        spell.maxPerTarget ? `${spell.maxPerTarget}/cible` : null,
        spell.critical ? `${spell.critical}% de critique` : null,
      ].filter(Boolean);
      detail.appendChild(el("p", "sim-detail-meta", meta.join(" · ")));

      if (spell.conditions && spell.conditions.length) {
        detail.appendChild(el("p", "sim-detail-cond", `Condition: ${spell.conditions.join(" ou ")}`));
      }

      if (spell.effects && spell.effects.length) {
        detail.appendChild(el("h4", "sim-detail-sub", "Effets"));
        detail.appendChild(effectList(spell.effects));
      }
      if (spell.critEffects && spell.critEffects.length) {
        detail.appendChild(el("h4", "sim-detail-sub", "En cas de coup critique"));
        detail.appendChild(effectList(spell.critEffects));
      }

      const stats = data.stats;
      if (stats) {
        detail.appendChild(el(
          "p",
          "sim-detail-note",
          `Estimations au niveau ${stats.level} (Songes): Force ${fmt(stats.strength)}, Intelligence ${fmt(stats.intelligence)}, Chance ${fmt(stats.chance)}, Agilité ${fmt(stats.agility)}. Avant résistances, sans Puissance ni bonus de dommages.`
        ));
      }
    }

    function selectSpell(spell, button) {
      state.spell = state.spell === spell ? null : spell;
      spellList.querySelectorAll(".sim-spell").forEach((node) => {
        node.setAttribute("aria-pressed", String(node === button && state.spell !== null));
      });
      renderDetail(state.spell);
      refreshRange();
      paintCells();
    }

    (data.spells || []).forEach((spell) => {
      const { title, detail } = spellLabel(spell);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sim-spell";
      button.setAttribute("aria-pressed", "false");
      const icon = spell.icon
        ? `<img class="sim-spell-icon" src="assets/spells/sort_${spell.icon}.png" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      const description = spell.desc ? `<small class="sim-spell-desc">${spell.desc}</small>` : "";
      button.innerHTML = `${icon}<span class="sim-spell-text"><strong>${title}</strong><small>${detail}</small>${description}</span>`;
      if (spell.desc) {
        button.title = spell.desc;
      }
      button.addEventListener("click", () => selectSpell(spell, button));
      spellList.appendChild(button);
    });

    let currentMap = -1;

    function loadMap(index) {
      currentMap = index;
      const map = index >= 0 ? maps[index] : null;
      const toKey = ([u, v]) => `${u},${v}`;
      state.mask = map ? new Set(map.cells.map(toKey)) : null;
      state.walls = new Set(map ? map.blocks.map(toKey) : []);
      state.startAlly = new Set(map ? map.ally.map(toKey) : []);
      state.startEnemy = new Set(map ? map.enemy.map(toKey) : []);
      state.allies = [];
      const firstEnemy = map && map.enemy.length ? { u: map.enemy[0][0], v: map.enemy[0][1] } : null;
      state.boss = firstEnemy || { ...DEFAULT_BOSS };
      updateSlab();
      drawWalls();
      drawAllies();
      placeBoss();
      refreshRange();
      refreshVisibility();
      paintCells();
    }

    section.querySelector(".sim-reset").addEventListener("click", () => {
      hare.player = null;
      hare.target = null;
      hareRefresh();
      loadMap(currentMap);
    });

    const harePanel = section.querySelector(".sim-hare-panel");
    const hareToggle = section.querySelector(".sim-hare-toggle");
    if (hareToggle) {
      hareToggle.addEventListener("change", () => {
        hare.on = hareToggle.checked;
        harePanel.hidden = !hare.on;
        hareRefresh();
        paintCells();
      });
      harePanel.querySelectorAll(".sim-hare-hp-btn").forEach((button) => {
        button.addEventListener("click", () => {
          hare.bracket = Number(button.dataset.i);
          harePanel.querySelectorAll(".sim-hare-hp-btn").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
          hareRefresh();
          paintCells();
        });
      });
      harePanel.querySelector(".sim-hare-melee-input").addEventListener("input", (event) => {
        hare.melee = Math.max(0, Math.min(12, Number(event.target.value) || 0));
        hareRefresh();
        paintCells();
      });
    }

    const mapSelect = section.querySelector(".sim-map");
    if (mapSelect) {
      mapSelect.addEventListener("change", () => loadMap(Number(mapSelect.value)));
    }

    const startsToggle = section.querySelector(".sim-starts");
    if (startsToggle) {
      startsToggle.addEventListener("change", () => {
        state.starts = startsToggle.checked;
        paintCells();
      });
    }

    section.querySelector(".sim-copy").addEventListener("click", async (event) => {
      const payload = JSON.stringify({
        map: currentMap >= 0 ? maps[currentMap].name : "Grille vide",
        blocs: [...state.walls].map((k) => k.split(",").map(Number)),
      });
      try {
        await navigator.clipboard.writeText(payload);
        event.target.textContent = "Copié !";
      } catch (error) {
        window.prompt("Copie ce texte:", payload);
      }
      setTimeout(() => { event.target.textContent = "Copier la carte"; }, 1500);
    });

    let dragMoved = false;
    let frame = null;
    function schedulePaint() {
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          paintCells();
        });
      }
    }

    board.addEventListener("pointermove", (event) => {
      const cell = cellFromPoint(event);
      if (state.drag && cell && !sameCell(cell, state.boss) && !state.walls.has(keyOf(cell)) && allowed(cell)) {
        state.boss = cell;
        dragMoved = true;
        state.allies = state.allies.filter((a) => !sameCell(a, cell));
        drawAllies();
        placeBoss();
        refreshRange();
        refreshVisibility();
      }
      if (!sameCell(cell, state.hover)) {
        state.hover = cell;
        schedulePaint();
      }
    });

    board.addEventListener("pointerup", (event) => {
      if (event.button !== 0) {
        return;
      }
      const cell = cellFromPoint(event) || state.hover;
      if (hare.on) {
        if (cell && allowed(cell) && !state.walls.has(keyOf(cell))) {
          hare.player = cell;
          hareRefresh();
          paintCells();
        }
        return;
      }
      if (!viewOnly && !state.drag && !dragMoved && cell && allowed(cell) && !sameCell(cell, state.boss) && !state.walls.has(keyOf(cell))) {
        const index = state.allies.findIndex((a) => sameCell(a, cell));
        if (index >= 0) {
          state.allies.splice(index, 1);
        } else if (state.allies.length < MAX_ALLIES) {
          state.allies.push(cell);
        }
        drawAllies();
      }
      state.drag = false;
      dragMoved = false;
      paintCells();
    });

    // Clic droit: poser ou retirer un obstacle
    board.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const cell = cellFromPoint(event);
      if (hare.on) {
        if (cell && allowed(cell)) {
          hare.target = cell;
          hareRefresh();
          paintCells();
        }
        return;
      }
      if (!cell || !allowed(cell) || (!viewOnly && sameCell(cell, state.boss))) {
        return;
      }
      const key = keyOf(cell);
      if (state.walls.has(key)) {
        state.walls.delete(key);
      } else {
        state.walls.add(key);
        state.allies = state.allies.filter((a) => !sameCell(a, cell));
        drawAllies();
      }
      drawWalls();
      refreshRange();
      refreshVisibility();
      paintCells();
    });

    board.addEventListener("pointerleave", () => {
      state.hover = null;
      state.drag = false;
      dragMoved = false;
      schedulePaint();
    });

    if (mapSelect) {
      mapSelect.value = String(initialMap);
    }
    if (options.showStarts) {
      if (startsToggle) {
        startsToggle.checked = true;
      }
      state.starts = true;
    }
    renderDetail(null);
    loadMap(initialMap);
  }

  root.TnulSimulator = { mount };
})(typeof window !== "undefined" ? window : globalThis);
