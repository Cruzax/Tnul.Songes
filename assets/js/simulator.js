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
    const allyImage = options.allyImage || "assets/allies/ouginak.png";
    const state = {
      boss: { u: 17, v: -3 },
      allies: [],
      walls: new Set(),
      spell: null,
      hover: null,
      drag: false,
    };
    const cache = { range: new Set(), visible: null };

    container.innerHTML = "";
    const section = document.createElement("section");
    section.className = "sim-section";
    section.innerHTML = `
      <div class="sim-header">
        <h2 class="sim-title">Simulation</h2>
        <div class="sim-tools">
          <button type="button" class="sim-reset">Réinitialiser</button>
        </div>
      </div>
      <p class="sim-hint">Glisse le boss. Clic gauche: poser ou retirer un allié. Clic droit: poser ou retirer un obstacle. Les cases sombres sont hors de la ligne de vue du boss.</p>`;
    const spellList = document.createElement("div");
    spellList.className = "sim-spells";
    section.appendChild(spellList);

    const board = svg("svg", { viewBox: `0 0 ${(G.COLS * 2 + 1) * A} ${(G.ROWS + 1) * B + SLAB}`, class: "sim-board" });
    const points = [];
    G.allCells().forEach((cell) => {
      const { px, py } = G.toScreen(cell.u, cell.v);
      const cx = (px + 1) * A;
      const cy = (py + 1) * B;
      points.push([cx - A, cy], [cx, cy - B], [cx + A, cy], [cx, cy + B]);
    });
    const hull = convexHull(points);
    board.appendChild(svg("polygon", {
      points: hull.map(([x, y]) => `${x},${y + SLAB}`).join(" "),
      class: "sim-slab",
    }));
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
    board.appendChild(bossToken);

    section.appendChild(board);
    const detail = document.createElement("div");
    detail.className = "sim-detail";
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

    // Recalculs lourds: seulement quand le boss, le sort ou les obstacles changent (pas au survol).
    function refreshRange() {
      cache.range = new Set();
      if (state.spell) {
        G.rangeCells(state.boss, state.spell, state.walls).forEach((c) => cache.range.add(keyOf(c)));
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
      const showShade = cache.visible && state.walls.size > 0;

      cellNodes.forEach((node, key) => {
        let cls = node._base;
        if (showShade && !cache.visible.has(key)) {
          cls += " nolos";
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

    section.querySelector(".sim-reset").addEventListener("click", () => {
      state.allies = [];
      state.walls = new Set();
      state.boss = { u: 17, v: -3 };
      drawWalls();
      drawAllies();
      placeBoss();
      refreshRange();
      refreshVisibility();
      paintCells();
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
      if (state.drag && cell && !sameCell(cell, state.boss) && !state.walls.has(keyOf(cell))) {
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
      if (!state.drag && !dragMoved && cell && !sameCell(cell, state.boss) && !state.walls.has(keyOf(cell))) {
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
      if (!cell || sameCell(cell, state.boss)) {
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

    renderDetail(null);
    drawAllies();
    placeBoss();
    refreshRange();
    refreshVisibility();
    paintCells();
  }

  root.TnulSimulator = { mount };
})(typeof window !== "undefined" ? window : globalThis);
