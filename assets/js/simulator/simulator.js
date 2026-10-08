(function (root) {
  const G = root.TnulGrid;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const A = 20; // demi-largeur d'une case
  const B_NORMAL = 10; // demi-hauteur d'une case: 2:1, comme dans le jeu
  const B_FLAT = 8; // grille des mobs: un peu plus plate
  let B = B_NORMAL; // fixé à chaque mount (une seule simulation à la fois par page)
  const WALL_HEIGHT = 10;
  const SLAB = 12; // épaisseur de la tranche sous la carte
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

  const icon = (name, fallback) => (root.TnulIcons ? root.TnulIcons.html(name) : fallback);

  // Les images de monstres ont des marges transparentes très variables (jusqu'à 25 % sous les pieds):
  // on mesure la partie réellement dessinée pour poser les pieds sur la case, au centre.
  const spriteBoxes = new Map();

  function measureSprite(url) {
    if (!spriteBoxes.has(url)) {
      spriteBoxes.set(url, new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(img, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < canvas.height; y += 1) {
              for (let x = 0; x < canvas.width; x += 1) {
                if (pixels[(y * canvas.width + x) * 4 + 3] > 24) {
                  minX = Math.min(minX, x);
                  maxX = Math.max(maxX, x);
                  minY = Math.min(minY, y);
                  maxY = Math.max(maxY, y);
                }
              }
            }
            resolve(maxX < 0 ? null : { width: canvas.width, height: canvas.height, minX, maxX, minY, maxY });
          } catch (error) {
            resolve(null); // image illisible (ex.: ouverture en file://): on garde le placement par défaut
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      }));
    }
    return spriteBoxes.get(url);
  }

  const SPRITE_SIZE = 44; // taille de référence: l'image entière tient dans ce carré (les proportions entre monstres sont gardées)
  const SPRITE_FEET = 2; // les pieds dépassent un peu sous le centre de la case

  async function alignSprite(node, url) {
    const box = await measureSprite(url);
    if (!box) {
      return;
    }
    const scale = SPRITE_SIZE / Math.max(box.width, box.height);
    node.setAttribute("width", box.width * scale);
    node.setAttribute("height", box.height * scale);
    node.setAttribute("x", -((box.minX + box.maxX + 1) / 2) * scale);
    node.setAttribute("y", -(box.maxY + 1) * scale + SPRITE_FEET);
  }

  function spellLabel(spell) {
    const range = spell.poMin === spell.poMax ? `${spell.poMax}` : `${spell.poMin}-${spell.poMax}`;
    const po = `${range} ${icon("po", "PO")}`;
    const extras = [spell.line ? "ligne" : null, spell.diagonal ? "diagonale" : null, spell.los ? null : "sans LDV"]
      .filter(Boolean);
    return { title: spell.name, detail: [`${icon("pa", "")} ${spell.pa} PA`, po, ...extras].join(" · ") };
  }

  function mount(container, options) {
    const { imageUrls, data } = options;
    B = options.compactGrid ? B_FLAT : B_NORMAL;
    const maps = options.maps || [];
    const DEFAULT_BOSS = { u: 17, v: -3 };
    // Grille vide réduite autour du boss (options.compactGrid): moins de cases quand aucune carte n'est choisie
    const compactCells = options.compactGrid
      ? G.allCells().filter((cell) => {
        const { px, py } = G.toScreen(cell.u, cell.v);
        const boss = G.toScreen(DEFAULT_BOSS.u, DEFAULT_BOSS.v);
        return Math.abs(px - boss.px) <= 9 && Math.abs(py - boss.py) <= 11;
      }).map((cell) => [cell.u, cell.v])
      : null;

    // Édition (options.editable): la grille vide modifiée est gardée dans le navigateur de l'utilisateur
    const EMPTY_NAME = "Grille vide (mobs)";
    const STORAGE_KEY = "tnul.grid.v1";
    const readSaved = () => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      } catch (error) {
        return {};
      }
    };
    const writeSaved = (saved) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch (error) {
        // stockage indisponible: les modifications durent le temps de la page
      }
    };
    const emptyOriginal = compactCells ? { name: EMPTY_NAME, cells: compactCells, blocks: [], ally: [], enemy: [] } : null;
    let emptyMap = emptyOriginal
      ? ((options.editable && readSaved()[EMPTY_NAME]) || JSON.parse(JSON.stringify(emptyOriginal)))
      : null;
    const mapAt = (index) => (index >= 0 ? maps[index] : emptyMap);
    const editor = { on: false, tool: "floor", painting: false, mode: true };
    const initialMap = options.noEmptyOption && maps.length ? 0 : -1;
    const viewOnly = Boolean(options.viewOnly);
    const allyImage = options.allyImage || "assets/images/allies/ouginak.png";
    const state = {
      boss: { u: 17, v: -3 },
      allies: [],
      walls: new Set(),
      mask: emptyMap ? new Set(emptyMap.cells.map(([u, v]) => `${u},${v}`)) : null, // Set des cases existantes (null = grille complète)
      starts: false,
      startAlly: new Set(),
      startEnemy: new Set(),
      spell: null,
      hover: null,
      drag: false,
    };
    const cache = { range: new Set(), blocked: new Set(), visible: null };
    // Mode Kimbo: le Disciple pose son glyphe sur toutes les cases de la parité de sa case (Air / Feu)
    // ou de la parité inverse (Terre / Eau), selon le dernier élément (hors Neutre) reçu par le Kimbo.
    const KIMBO_ELEMENTS = [["airfire", "Air / Feu", true], ["earthwater", "Terre / Eau", false]];
    const kimbo = { on: false, element: "airfire", disciple: null };
    const parityOf = (cell) => ((cell.u + cell.v) % 2 + 2) % 2;
    const kimboGlyphParity = () => {
      if (!kimbo.disciple) {
        return null;
      }
      const same = KIMBO_ELEMENTS.find((e) => e[0] === kimbo.element)[2];
      return same ? parityOf(kimbo.disciple) : 1 - parityOf(kimbo.disciple);
    };
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
        <h2 class="sim-title">${root.TnulIcons ? root.TnulIcons.html("crosshair") : ""}Simulation</h2>
        <div class="sim-tools">
          ${maps.length ? '<div class="sim-map-tabs" role="group" aria-label="Carte">' + (options.noEmptyOption ? "" : '<button type="button" class="sim-map-tab" data-index="-1" aria-pressed="false">Grille vide</button>') + maps.map((m, i) => `<button type="button" class="sim-map-tab" data-index="${i}" aria-pressed="false">${m.name.replace(/^Salle de boss — /, "").replace(/^./, (c) => c.toUpperCase())}</button>`).join("") + "</div>" : ""}
          ${maps.length && !options.hideStartsToggle ? '<label class="sim-starts-label"><input type="checkbox" class="sim-starts"> Placements de départ</label>' : ""}
          ${options.kimbo ? '<label class="sim-hare-label"><input type="checkbox" class="sim-kimbo-toggle"> Mode Kimbo</label>' : ""}
          ${options.harebourg ? '<label class="sim-hare-label"><input type="checkbox" class="sim-hare-toggle"> Mode Harebourg</label>' : ""}
          ${options.editable ? '<label class="sim-edit-label"><input type="checkbox" class="sim-edit-toggle"> Éditer la grille</label>' : ""}
          ${options.hideReset ? "" : '<button type="button" class="sim-reset">Réinitialiser</button>'}
        </div>
      </div>
      <div class="sim-editor" hidden>
        <div class="sim-editor-tools">
          <button type="button" class="sim-tool" data-tool="floor" aria-pressed="true">Sol</button>
          <button type="button" class="sim-tool" data-tool="block" aria-pressed="false">Bloc</button>
        </div>
        <p class="sim-editor-hint">Clique ou glisse sur la grille: ça ajoute la case si elle n'existe pas, sinon ça la retire. Les cases en pointillés sont vides.</p>
        <div class="sim-editor-actions">
          <button type="button" class="sim-edit-export">Copier la grille</button>
          <button type="button" class="sim-edit-restore">Restaurer l'originale</button>
        </div>
      </div>
      <div class="sim-hare-panel sim-kimbo-panel" hidden>
        <p class="sim-kimbo-q">Dernier élément (hors Neutre) tapé sur le Kimbo:</p>
        <div class="sim-hare-hp">${KIMBO_ELEMENTS.map(([key, label]) => `<button type="button" class="sim-hare-hp-btn sim-kimbo-el" data-el="${key}" aria-pressed="${key === "airfire"}">${label}</button>`).join("")}</div>
        <ul class="sim-hare-legend">
          <li><span class="sim-swatch kimbo-disciple"></span>Clic gauche: Disciple du Kimbo</li>
        </ul>
        <p class="sim-hare-info sim-kimbo-info">Clique sur la case où se trouve le Disciple.</p>
      </div>
      <div class="sim-hare-panel" hidden>
        <div class="sim-hare-hp">${HARE_BRACKETS.map((b, i) => `<button type="button" class="sim-hare-hp-btn" data-i="${i}" aria-pressed="${i === 0}">${b.label}</button>`).join("")}</div>
        <label class="sim-hare-melee">Coups en mêlée <input type="number" class="sim-hare-melee-input" min="0" max="12" value="0"></label>
        <ul class="sim-legend">
          <li><span class="sim-swatch hare-player"></span>Ton perso (clic gauche)</li>
          <li><span class="sim-swatch hare-target"></span>Case que tu veux toucher (clic droit)</li>
          <li><span class="sim-swatch hare-aim"></span>Case à viser pour compenser la confusion</li>
        </ul>
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

    // Recadre la vue sur les cases qui existent (carte réelle) plutôt que sur la grille complète
    function fitBoard() {
      // En édition on cadre toute la grille pour pouvoir ajouter des cases n'importe où
      const cells = G.allCells().filter((cell) => editor.on || !state.mask || state.mask.has(keyOf(cell)));
      if (!cells.length) {
        return;
      }
      const xs = cells.map((cell) => center(cell).x);
      const ys = cells.map((cell) => center(cell).y);
      const left = Math.min(...xs) - A - 8;
      const top = Math.min(...ys) - B - 44; // place pour les murs et le jeton du boss
      const width = Math.max(...xs) + A + 8 - left;
      const height = Math.max(...ys) + B + SLAB + 8 - top;
      board.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
    }

    function updateSlab() {
      fitBoard();
      slab.innerHTML = "";
      const exists = (u, v) => (state.mask ? state.mask.has(`${u},${v}`) : G.isValid(u, v));
      // Tranche de la carte: une face verticale sous chaque bord visible (là où la case voisine
      // vers l'avant n'existe pas), à gauche (u, v-1) et à droite (u+1, v).
      G.allCells().forEach((cell) => {
        if (!exists(cell.u, cell.v)) {
          return;
        }
        const { x, y } = center(cell);
        if (!exists(cell.u, cell.v - 1)) {
          slab.appendChild(svg("polygon", {
            points: `${x - A},${y} ${x},${y + B} ${x},${y + B + SLAB} ${x - A},${y + SLAB}`,
            class: "sim-slab-left",
          }));
        }
        if (!exists(cell.u + 1, cell.v)) {
          slab.appendChild(svg("polygon", {
            points: `${x},${y + B} ${x + A},${y} ${x + A},${y + SLAB} ${x},${y + B + SLAB}`,
            class: "sim-slab-right",
          }));
        }
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
        class: `sim-cell${px % 2 === 1 ? " alt" : ""}`,
      });
      polygon.dataset.u = cell.u;
      polygon.dataset.v = cell.v;
      polygon._base = polygon.getAttribute("class");
      polygon._cls = polygon._base;
      board.appendChild(polygon);
      cellNodes.set(keyOf(cell), polygon);
    });

    // Murs, alliés et boss partagent une couche triée par profondeur (u - v croissant = du fond vers l'avant),
    // pour qu'un personnage placé derrière un mur soit bien masqué par lui.
    const objectsLayer = svg("g", { class: "sim-objects" });
    board.appendChild(objectsLayer);

    function sortObjects() {
      [...objectsLayer.children]
        .sort((a, b) => Number(a.dataset.depth) - Number(b.dataset.depth))
        .forEach((node) => objectsLayer.appendChild(node));
    }

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
      image.addEventListener("load", () => {
        bossFallback.remove();
        alignSprite(image, imageUrls[attempt]);
      });
      bossToken.appendChild(image);
    }
    bossToken.addEventListener("pointerdown", (event) => {
      state.drag = true;
      board.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    bossToken.style.display = viewOnly ? "none" : "";
    objectsLayer.appendChild(bossToken);

    if (viewOnly) {
      spellList.hidden = true;
    }
    const detail = document.createElement("div");
    detail.className = "sim-detail";
    detail.hidden = viewOnly;
    section.appendChild(board);
    section.appendChild(detail);
    container.appendChild(section);

    function cellFromPoint(event) {
      const node = state.drag || editor.painting ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
      if (node && node.dataset && node.dataset.u !== undefined) {
        return { u: Number(node.dataset.u), v: Number(node.dataset.v) };
      }
      return null;
    }

    const sameCell = (a, b) => Boolean(a && b && a.u === b.u && a.v === b.v);

    const depthOf = (cell) => cell.u - cell.v;

    function clearObjects(className) {
      objectsLayer.querySelectorAll(`.${className}`).forEach((node) => node.remove());
    }

    function drawWalls() {
      clearObjects("sim-wall");
      [...state.walls].forEach((key) => {
        const [u, v] = key.split(",").map(Number);
        const { x, y } = center({ u, v });
        const lift = (dy) => y - dy;
        const wall = svg("g", { class: "sim-wall" });
        wall.dataset.depth = depthOf({ u, v });
        wall.appendChild(svg("polygon", {
          points: `${x - A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B} ${x},${y + B} ${x - A},${y}`,
          class: "sim-wall-left",
        }));
        wall.appendChild(svg("polygon", {
          points: `${x + A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B} ${x},${y + B} ${x + A},${y}`,
          class: "sim-wall-right",
        }));
        wall.appendChild(svg("polygon", {
          points: `${x - A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) - B} ${x + A},${lift(WALL_HEIGHT)} ${x},${lift(WALL_HEIGHT) + B}`,
          class: "sim-wall-top",
        }));
        objectsLayer.appendChild(wall);
      });
      sortObjects();
    }

    function drawAllies() {
      clearObjects("sim-ally-sprite");
      state.allies.forEach((ally) => {
        const c = center(ally);
        const sprite = svg("image", {
          href: allyImage, x: c.x - 22, y: c.y - 40, width: 44, height: 44, class: "sim-ally-sprite",
        });
        sprite.dataset.depth = depthOf(ally);
        objectsLayer.appendChild(sprite);
      });
      sortObjects();
    }

    function placeBoss() {
      const c = center(state.boss);
      bossToken.setAttribute("transform", `translate(${c.x} ${c.y})`);
      bossToken.dataset.depth = depthOf(state.boss);
      sortObjects();
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
        info.textContent = "Place ton perso et la case que tu veux toucher: la case à viser apparaît en blanc.";
      } else {
        info.textContent = `Confusion de ${hareAngle()}°. ${hareAim() ? "Vise la case blanche." : "Case à viser impossible (mur ou hors de la carte)."}`;
      }
    }

    // Recalculs lourds: seulement quand le boss, le sort ou les obstacles changent (pas au survol).
    // Obstacles + personnages posés: tout ça coupe la ligne de vue du boss
    const losBlockers = () => new Set([...state.walls, ...state.allies.map(keyOf)]);

    function refreshRange() {
      cache.range = new Set();
      cache.blocked = new Set();
      if (state.spell) {
        G.rangeCells(state.boss, state.spell, state.walls, losBlockers())
          .filter((c) => allowed(c))
          .forEach((c) => cache.range.add(keyOf(c)));
        // Cases à portée mais cachées par un obstacle (seulement pour un sort qui demande une ligne de vue)
        if (state.spell.los) {
          G.rangeCells(state.boss, { ...state.spell, los: false }, state.walls)
            .filter((c) => allowed(c) && !cache.range.has(keyOf(c)))
            .forEach((c) => cache.blocked.add(keyOf(c)));
        }
      }
    }

    function refreshVisibility() {
      cache.visible = G.visibleKeys(state.boss, losBlockers());
    }

    function paintCells() {
      const zone = new Set();
      if (state.spell && state.hover && cache.range.has(keyOf(state.hover))) {
        G.zoneCells(state.hover, state.boss, state.spell.zone).forEach((c) => zone.add(keyOf(c)));
      }
      const allies = new Set(state.allies.map(keyOf));
      const hoverKey = state.hover ? keyOf(state.hover) : null;
      // Un sort sans ligne de vue ignore les obstacles: on n'assombrit alors rien
      const sansLdv = Boolean(state.spell && !state.spell.los);
      const showShade = hare.on ? Boolean(hare.visible && state.walls.size > 0) : !viewOnly && !sansLdv && cache.visible && (state.walls.size > 0 || state.allies.length > 0);
      const visibleSet = hare.on ? hare.visible : cache.visible;
      const aim = hare.on ? hareAim() : null;
      const playerKey = hare.on && hare.player ? keyOf(hare.player) : null;
      const targetKey = hare.on && hare.target ? keyOf(hare.target) : null;
      const aimKey = aim ? keyOf(aim) : null;
      const kimboGlyph = kimbo.on ? kimboGlyphParity() : null;

      cellNodes.forEach((node, key) => {
        let cls = node._base;
        if (state.mask && !state.mask.has(key)) {
          cls += " void";
        } else if (showShade && !visibleSet.has(key)) {
          cls += " nolos";
        }
        if (kimbo.on && kimboGlyph !== null && !(state.mask && !state.mask.has(key))) {
          const [ku, kv] = key.split(",").map(Number);
          if (parityOf({ u: ku, v: kv }) === kimboGlyph) {
            cls += " kimbo-glyph";
          }
        }
        if (kimbo.on && kimbo.disciple && key === keyOf(kimbo.disciple)) {
          cls += " kimbo-disciple";
        }
        if (state.starts && !hare.on && state.startEnemy.has(key)) {
          cls += " start-enemy";
        }
        if (state.starts && !hare.on && state.startAlly.has(key)) {
          cls += " start-ally";
        }
        if (cache.blocked.has(key)) {
          cls += " range-blocked";
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
        // Version simple: on ne précise la cible que si elle sort de l'ordinaire (les ennemis, c'est le cas par défaut)
        const notes = [];
        if (effect.target && effect.target !== "les ennemis du lanceur") {
          notes.push(effect.target.replace(/ \(.*?\)/g, ""));
        }
        if (effect.except) {
          notes.push(effect.except.replace("les entités possédant l'état", "sauf si état"));
        }
        if (effect.when) {
          notes.push(`si ${effect.when}`);
        }
        if (notes.length) {
          item.appendChild(el("span", "sim-effect-note", notes.join(" · ")));
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
        icon.src = `assets/images/spells/sort_${spell.icon}.png`;
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
          `Estimé au niveau ${stats.level}, avant résistances.`
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
        ? `<img class="sim-spell-icon" src="assets/images/spells/sort_${spell.icon}.png" alt="" loading="lazy" onerror="this.remove()">`
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
      const map = mapAt(index);
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

    section.querySelector(".sim-reset")?.addEventListener("click", () => {
      hare.player = null;
      hare.target = null;
      hareRefresh();
      loadMap(currentMap);
    });

    const kimboPanel = section.querySelector(".sim-kimbo-panel");
    const kimboToggle = section.querySelector(".sim-kimbo-toggle");
    function kimboRefresh() {
      const info = section.querySelector(".sim-kimbo-info");
      const parity = kimboGlyphParity();
      if (parity === null) {
        info.textContent = "Clique sur la case où se trouve le Disciple.";
        return;
      }
      const name = KIMBO_ELEMENTS.find((e) => e[0] === kimbo.element)[1];
      const same = parity === parityOf(kimbo.disciple);
      info.textContent = `${name}: le glyphe sort sur les cases de la ${same ? "même parité que le Disciple" : "parité inverse du Disciple"}. Reste sur les cases sans glyphe.`;
    }
    if (kimboToggle) {
      kimboToggle.addEventListener("change", () => {
        kimbo.on = kimboToggle.checked;
        kimboPanel.hidden = !kimbo.on;
        if (kimbo.on) {
          const hareBox = section.querySelector(".sim-hare-toggle");
          if (hareBox && hareBox.checked) {
            hareBox.checked = false;
            hareBox.dispatchEvent(new Event("change"));
          }
        }
        kimboRefresh();
        paintCells();
      });
      kimboPanel.querySelectorAll(".sim-kimbo-el").forEach((button) => {
        button.addEventListener("click", () => {
          kimbo.element = button.dataset.el;
          kimboPanel.querySelectorAll(".sim-kimbo-el").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
          kimboRefresh();
          paintCells();
        });
      });
    }

    const harePanel = section.querySelector(".sim-hare-panel:not(.sim-kimbo-panel)");
    const hareToggle = section.querySelector(".sim-hare-toggle");
    if (hareToggle) {
      hareToggle.addEventListener("change", () => {
        hare.on = hareToggle.checked;
        if (hare.on && kimboToggle && kimboToggle.checked) {
          kimboToggle.checked = false;
          kimboToggle.dispatchEvent(new Event("change"));
        }
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

    const mapTabs = [...section.querySelectorAll(".sim-map-tab")];
    const markMapTab = (index) => mapTabs.forEach((tab) => tab.setAttribute("aria-pressed", String(Number(tab.dataset.index) === index)));
    mapTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const index = Number(tab.dataset.index);
        markMapTab(index);
        loadMap(index);
      });
    });

    const startsToggle = section.querySelector(".sim-starts");
    if (startsToggle) {
      startsToggle.addEventListener("change", () => {
        state.starts = startsToggle.checked;
        paintCells();
      });
    }

    // ---- Édition de la grille vide (options.editable): sol et blocs ----
    const editPanel = section.querySelector(".sim-editor");
    const editToggle = section.querySelector(".sim-edit-toggle");
    const toolSet = () => (editor.tool === "block" ? state.walls : state.mask);

    function saveEdit() {
      const toList = (set) => [...set].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      emptyMap = { name: EMPTY_NAME, cells: toList(state.mask), blocks: toList(state.walls), ally: [], enemy: [] };
      const saved = readSaved();
      saved[EMPTY_NAME] = emptyMap;
      writeSaved(saved);
    }

    // add = true pose l'élément, false le retire. Retirer du sol retire aussi le bloc qui était dessus.
    function applyTool(cell, add) {
      if (!cell) {
        return;
      }
      const key = keyOf(cell);
      if (editor.tool === "block" && !state.mask.has(key)) {
        return; // sur une case vide, seul l'outil Sol agit
      }
      const target = toolSet();
      if (target.has(key) === add) {
        return;
      }
      if (add) {
        target.add(key);
        if (editor.tool === "block") {
          state.allies = state.allies.filter((a) => !sameCell(a, cell));
          drawAllies();
        }
      } else {
        target.delete(key);
        if (editor.tool === "floor") {
          state.walls.delete(key);
          state.allies = state.allies.filter((a) => !sameCell(a, cell));
          drawAllies();
        }
      }
      updateSlab();
      drawWalls();
      refreshRange();
      refreshVisibility();
      paintCells();
      saveEdit();
    }

    function setEditing(on) {
      editor.on = on;
      editPanel.hidden = !on;
      board.classList.toggle("editing", on);
      section.querySelector(".sim-hint").hidden = on;
      updateSlab();
      paintCells();
    }

    if (editToggle) {
      editToggle.addEventListener("change", () => setEditing(editToggle.checked));
      section.querySelectorAll(".sim-tool").forEach((button) => {
        button.addEventListener("click", () => {
          editor.tool = button.dataset.tool;
          section.querySelectorAll(".sim-tool").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        });
      });
      section.querySelector(".sim-edit-export").addEventListener("click", async (event) => {
        const label = "Copier la grille";
        const text = JSON.stringify(emptyMap);
        try {
          await navigator.clipboard.writeText(text);
          event.target.textContent = "Copié !";
        } catch (error) {
          window.prompt("Copie ce texte:", text);
        }
        setTimeout(() => { event.target.textContent = label; }, 1500);
      });
      section.querySelector(".sim-edit-restore").addEventListener("click", () => {
        emptyMap = JSON.parse(JSON.stringify(emptyOriginal));
        const saved = readSaved();
        delete saved[EMPTY_NAME];
        writeSaved(saved);
        loadMap(-1);
      });
      board.addEventListener("pointerdown", (event) => {
        if (!editor.on || event.button !== 0) {
          return;
        }
        const cell = cellFromPoint(event);
        if (!cell) {
          return;
        }
        editor.mode = !toolSet().has(keyOf(cell)); // le 1er clic décide: ajouter ou retirer, pour tout le glissé
        editor.painting = true;
        board.setPointerCapture(event.pointerId);
        applyTool(cell, editor.mode);
        event.preventDefault();
      });
    }

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
      if (editor.painting) {
        applyTool(cell, editor.mode);
      }
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
      if (editor.on) {
        editor.painting = false;
        return;
      }
      const cell = cellFromPoint(event) || state.hover;
      if (kimbo.on) {
        if (cell && allowed(cell) && !state.walls.has(keyOf(cell))) {
          kimbo.disciple = sameCell(kimbo.disciple, cell) ? null : cell; // un second clic sur la même case le retire
          kimboRefresh();
          paintCells();
        }
        return;
      }
      if (hare.on) {
        if (cell && allowed(cell) && !state.walls.has(keyOf(cell))) {
          hare.player = sameCell(hare.player, cell) ? null : cell; // un second clic sur la même case la retire
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
        refreshRange(); // un personnage coupe la ligne de vue du boss
        refreshVisibility();
      }
      state.drag = false;
      dragMoved = false;
      paintCells();
    });

    // Clic droit: poser ou retirer un obstacle
    board.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (editor.on) {
        return;
      }
      const cell = cellFromPoint(event);
      if (kimbo.on) {
        return;
      }
      if (hare.on) {
        if (cell && allowed(cell)) {
          hare.target = sameCell(hare.target, cell) ? null : cell; // un second clic droit sur la même case la retire
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
      editor.painting = false;
      dragMoved = false;
      schedulePaint();
    });

    markMapTab(initialMap);
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
