// Page d'aide au combat de Bolgrot: placement des feux, calcul du plan, relecture pas à pas.
(async function () {
  const E = window.TnulBolgrotEngine;
  const SX = 30;
  const SY = 15;
  const SIDE = 10;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = E.W;
  const EXAMPLE = {
    fires: [[15, 6], [17, 6], [10, 8], [12, 8], [6, 9], [16, 9], [13, 11], [16, 11], [18, 11], [5, 15], [19, 15], [5, 17], [19, 17], [25, 19], [18, 21], [25, 21], [12, 22], [18, 23], [15, 24], [17, 24], [15, 26], [1, 13], [2, 12], [5, 13]],
    glyphs: [[12, 6], [14, 11], [20, 21], [15, 22], [3, 15], [3, 13]],
    player: [15, 15],
  };
  // Flèches vues à l'écran: gx+ part en bas à droite, gy+ en bas à gauche.
  const ARROW = { "1,0": "↘", "-1,0": "↖", "0,1": "↙", "0,-1": "↗" };
  const ARROW_NAME = { "1,0": "bas-droite", "-1,0": "haut-gauche", "0,1": "bas-gauche", "0,-1": "haut-droite" };
  const IMMO = { "1,1": ["⬇", "en bas"], "-1,-1": ["⬆", "en haut"], "1,-1": ["➡", "à droite"], "-1,1": ["⬅", "à gauche"] };

  const el = (id) => document.getElementById(id);
  const board = el("bg-board");

  let def;
  try {
    def = await fetch("data/bolgrot.json").then((response) => response.json());
  } catch (error) {
    board.replaceWith(Object.assign(document.createElement("p"), { textContent: "Impossible de charger la carte." }));
    console.error("Erreur de chargement:", error.message);
    return;
  }
  const ctx = E.makeCtx(def);
  const BOLGROT = def.bolgrot[1] * W + def.bolgrot[0];
  const idxOf = ([x, y]) => y * W + x;
  const gx = (i) => i % W;
  const gy = (i) => (i / W) | 0;
  const toXY = (i) => ({ x: (gx(i) - gy(i)) * SX, y: (gx(i) + gy(i)) * SY });

  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) {
      parent.appendChild(node);
    }
    return node;
  };
  const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");

  const openCells = [];
  for (let i = 0; i < W * E.H; i += 1) {
    if (!ctx.blocked[i]) {
      openCells.push(i);
    }
  }
  const isOpen = (x, y) => x >= 0 && x < W && y >= 0 && y < E.H && !ctx.blocked[y * W + x] && y * W + x !== BOLGROT;

  const ed = {
    player: idxOf(def.player),
    fires: new Set(),
    glyphs: new Set(),
    turn: 6,
    pv: 40,
    pa: 10,
    doubles: 0,
    tool: "fire",
  };
  const ui = { plan: null, step: 0, worker: null, busy: false };

  // ---- Outils ----
  const TOOLS = [
    { id: "fire", label: "Feu", color: "#e8702a" },
    { id: "glyph", label: "Glyphe violet (tour 6)", color: "#8a4fc8" },
    { id: "player", label: "Ma position", color: "#6ebaed" },
    { id: "erase", label: "Effacer", color: "#76829f" },
  ];
  TOOLS.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bg-tool";
    button.dataset.tool = tool.id;
    const swatch = document.createElement("span");
    swatch.className = "bg-swatch";
    swatch.style.background = tool.color;
    button.append(swatch, tool.label);
    button.addEventListener("click", () => {
      ed.tool = tool.id;
      renderTools();
    });
    el("bg-tools").appendChild(button);
  });
  function renderTools() {
    document.querySelectorAll(".bg-tool").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tool === ed.tool));
      if (button.dataset.tool === "glyph") {
        button.disabled = ed.turn > 6;
      }
    });
  }

  [
    ["#e8702a", "feu"],
    ["#8a4fc8", "glyphe (feu au prochain tour)"],
    ["#6ebaed", "toi"],
    ["#9aa6c2", "Bolgrot (obstacle)"],
  ].forEach(([color, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "bg-swatch";
    swatch.style.background = color;
    item.append(swatch, label);
    el("bg-legend").appendChild(item);
  });

  const turnSelect = el("bg-turn");
  for (let t = 6; t <= 16; t += 1) {
    turnSelect.appendChild(Object.assign(document.createElement("option"), { value: String(t), textContent: `Tour ${t}` }));
  }

  // ---- Carte ----
  const xs = openCells.map((i) => toXY(i).x);
  const ys = openCells.map((i) => toXY(i).y);
  const minX = Math.min(...xs) - SX;
  const maxX = Math.max(...xs) + SX;
  const minY = Math.min(...ys) - SY - 24;
  const maxY = Math.max(...ys) + SY + SIDE;
  board.setAttribute("viewBox", `${minX - 4} ${minY - 4} ${maxX - minX + 8} ${maxY - minY + 8}`);

  const slabLayer = svg("g", {}, board);
  const cellLayer = svg("g", {}, board);
  const itemLayer = svg("g", {}, board);
  const cellNodes = new Map();

  openCells.forEach((i) => {
    const { x, y } = toXY(i);
    const hasRight = isOpen(gx(i) + 1, gy(i)) || gx(i) + 1 === def.bolgrot[0] && gy(i) === def.bolgrot[1];
    const hasLeft = isOpen(gx(i), gy(i) + 1) || gx(i) === def.bolgrot[0] && gy(i) + 1 === def.bolgrot[1];
    if (!hasLeft) {
      svg("polygon", { class: "bg-slab-l", points: pts([[x - SX, y], [x, y + SY], [x, y + SY + SIDE], [x - SX, y + SIDE]]) }, slabLayer);
    }
    if (!hasRight) {
      svg("polygon", { class: "bg-slab-r", points: pts([[x, y + SY], [x + SX, y], [x + SX, y + SIDE], [x, y + SY + SIDE]]) }, slabLayer);
    }
    const cell = svg("polygon", { class: "bg-cell" + ((gx(i) - gy(i)) % 2 ? " alt" : ""), points: pts([[x, y - SY], [x + SX, y], [x, y + SY], [x - SX, y]]) }, cellLayer);
    cell.dataset.i = String(i);
    cellNodes.set(i, cell);
  });

  function drawCube(parent, i, height) {
    const { x, y } = toXY(i);
    const up = y - height;
    const g = svg("g", {}, parent);
    svg("polygon", { class: "bg-wall-l", points: pts([[x - SX, up], [x, up + SY], [x, y + SY], [x - SX, y]]) }, g);
    svg("polygon", { class: "bg-wall-r", points: pts([[x + SX, up], [x, up + SY], [x, y + SY], [x + SX, y]]) }, g);
    svg("polygon", { class: "bg-wall-top", points: pts([[x - SX, up], [x, up - SY], [x + SX, up], [x, up + SY]]) }, g);
  }

  // ---- Affichage ----
  function viewState() {
    if (ui.plan && ui.step > 0) {
      return ui.plan.states[ui.step];
    }
    return { p: ed.player, fires: [...ed.fires], glyphs: [...ed.glyphs], pv: ed.pv, pa: ed.pa, turn: ed.turn };
  }

  function draw() {
    const view = viewState();
    const prev = ui.plan && ui.step > 0 ? ui.plan.states[ui.step - 1] : null;
    const prevFires = prev ? new Set(prev.fires) : null;
    const glyphSet = new Set(view.glyphs || []);
    const killedCell = ui.plan && ui.step > 0 && ui.plan.kills[ui.step - 1] ? view.p : -1;
    cellNodes.forEach((node, i) => {
      node.classList.toggle("glyph", glyphSet.has(i));
      node.classList.toggle("killed", i === killedCell);
      node.classList.toggle("landed", i === view.p && ui.step > 0);
    });
    itemLayer.innerHTML = "";
    const items = [];
    items.push({ order: gx(BOLGROT) + gy(BOLGROT), draw: () => drawCube(itemLayer, BOLGROT, 22) });
    view.fires.forEach((f) => {
      items.push({
        order: gx(f) + gy(f),
        draw: () => {
          const { x, y } = toXY(f);
          const g = svg("g", { class: "bg-fire" + (prevFires && !prevFires.has(f) ? " moved" : "") }, itemLayer);
          svg("ellipse", { class: "bg-fire-body", cx: x, cy: y - 5, rx: 12, ry: 9 }, g);
          svg("circle", { class: "bg-fire-core", cx: x, cy: y - 7, r: 4 }, g);
        },
      });
    });
    items.push({
      order: gx(view.p) + gy(view.p) + 0.5,
      draw: () => {
        const { x, y } = toXY(view.p);
        const g = svg("g", { class: "bg-player" }, itemLayer);
        svg("ellipse", { class: "bg-player-shadow", cx: x, cy: y + 3, rx: 11, ry: 5 }, g);
        svg("circle", { class: "bg-player-body", cx: x, cy: y - 8, r: 9 }, g);
      },
    });
    items.sort((a, b) => a.order - b.order).forEach((item) => item.draw());
  }

  function describe(action, before, after) {
    const killed = after.fires.length < before.fires.length;
    if (action.kind === "end") {
      return { arrow: "⏎", text: "Fin de tour", note: "−1 PV", kill: false };
    }
    if (action.kind === "immo") {
      const [arrow, where] = IMMO[`${action.dx},${action.dy}`];
      return { arrow, text: `Immobilisme ${where}`, note: "−5 PV", kill: false };
    }
    const key = `${action.dx},${action.dy}`;
    const name = action.kind === "double" ? "Bond double" : "Bond astral";
    const arrow = action.kind === "double" ? ARROW[key] + ARROW[key] : ARROW[key];
    return { arrow, text: `${name} ${ARROW_NAME[key]}`, note: "", kill: killed };
  }

  function renderPlan() {
    const card = el("bg-plan-card");
    card.hidden = !ui.plan;
    const list = el("bg-plan");
    list.innerHTML = "";
    if (!ui.plan) {
      return;
    }
    const { path, states } = ui.plan;
    let lastTurn = null;
    path.forEach((action, index) => {
      const before = states[index];
      const after = states[index + 1];
      if (before.turn !== lastTurn) {
        lastTurn = before.turn;
        const header = document.createElement("li");
        header.className = "turn";
        header.textContent = `Tour ${before.turn}`;
        list.appendChild(header);
      }
      const info = describe(action, before, after);
      const item = document.createElement("li");
      if (ui.step === index + 1) {
        item.classList.add("current");
      }
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = info.arrow;
      const text = document.createElement("span");
      text.textContent = info.text;
      item.append(arrow, text);
      if (info.kill) {
        item.appendChild(Object.assign(document.createElement("span"), { className: "kill", textContent: "feu tué" }));
      } else if (info.note) {
        item.appendChild(Object.assign(document.createElement("span"), { className: "cost", textContent: info.note }));
      }
      item.addEventListener("click", () => {
        ui.step = index + 1;
        refresh();
      });
      list.appendChild(item);
      if (ui.step === index + 1) {
        requestAnimationFrame(() => item.scrollIntoView({ block: "nearest" }));
      }
    });
    const last = states[states.length - 1];
    el("bg-summary").textContent = `${path.length} actions, victoire au tour ${last.turn} avec ${last.pv} PV.`;
  }

  function renderStepBar() {
    const total = ui.plan ? ui.plan.path.length : 0;
    el("bg-prev").disabled = ui.step === 0;
    el("bg-next").disabled = ui.step >= total;
    const view = viewState();
    el("bg-step-label").textContent = (ui.step === 0 ? "Départ" : `Action ${ui.step}/${total}`) + ` · ${view.fires.length} feu${view.fires.length > 1 ? "x" : ""} · ${view.pv} PV`;
  }

  function syncFields() {
    turnSelect.value = String(ed.turn);
    el("bg-pv").value = String(ed.pv);
    el("bg-pa").value = String(ed.pa);
    el("bg-count").textContent = `${ed.fires.size} feu${ed.fires.size > 1 ? "x" : ""}` + (ed.turn <= 6 ? `, ${ed.glyphs.size} glyphe${ed.glyphs.size > 1 ? "s" : ""}` : "") + ` (36 au maximum)`;
  }

  function refresh() {
    draw();
    renderPlan();
    renderStepBar();
    syncFields();
    renderTools();
    el("bg-solve").disabled = ui.busy || ed.fires.size === 0;
  }

  function clearPlan() {
    ui.plan = null;
    ui.step = 0;
  }
  function message(text, ok) {
    const node = el("bg-message");
    node.textContent = text || "";
    node.classList.toggle("ok", Boolean(ok));
  }

  // ---- Placement ----
  function place(i, tool) {
    if (ui.busy || i === BOLGROT) {
      return;
    }
    clearPlan();
    if (tool === "player") {
      ed.player = i;
      ed.fires.delete(i);
      ed.glyphs.delete(i);
    } else if (tool === "fire") {
      if (i === ed.player) {
        return;
      }
      if (ed.fires.has(i)) {
        ed.fires.delete(i);
      } else {
        ed.fires.add(i);
        ed.glyphs.delete(i);
      }
    } else if (tool === "glyph") {
      if (ed.turn > 6 || i === ed.player) {
        return;
      }
      if (ed.glyphs.has(i)) {
        ed.glyphs.delete(i);
      } else {
        ed.glyphs.add(i);
        ed.fires.delete(i);
      }
    } else {
      ed.fires.delete(i);
      ed.glyphs.delete(i);
    }
    message("");
    refresh();
  }
  const cellOf = (event) => (event.target.dataset && event.target.dataset.i !== undefined ? Number(event.target.dataset.i) : null);
  board.addEventListener("click", (event) => {
    const i = cellOf(event);
    if (i !== null && ui.step === 0) {
      place(i, ed.tool);
    }
  });
  board.addEventListener("contextmenu", (event) => {
    const i = cellOf(event);
    event.preventDefault();
    if (i !== null && ui.step === 0) {
      place(i, "erase");
    }
  });

  turnSelect.addEventListener("change", () => {
    ed.turn = Number(turnSelect.value);
    if (ed.turn > 6) {
      ed.glyphs.clear();
      if (ed.tool === "glyph") ed.tool = "fire";
    }
    ed.pv = ed.turn === 6 ? Math.max(ed.pv, 40) : Math.min(ed.pv, 40);
    clearPlan();
    refresh();
  });
  const clampField = (id, min, max) => Math.min(max, Math.max(min, Math.round(Number(el(id).value)) || min));
  ["bg-pv", "bg-pa"].forEach((id) => el(id).addEventListener("change", () => {
    ed.pv = clampField("bg-pv", 1, 40);
    ed.pa = clampField("bg-pa", 1, 10);
    clearPlan();
    refresh();
  }));
  el("bg-example").addEventListener("click", () => {
    ed.player = idxOf(EXAMPLE.player);
    ed.fires = new Set(EXAMPLE.fires.map(idxOf));
    ed.glyphs = new Set(EXAMPLE.glyphs.map(idxOf));
    ed.turn = 6;
    ed.pv = 40;
    ed.pa = 10;
    ed.doubles = 0;
    clearPlan();
    message("Exemple chargé: clique « Trouver un plan ».", true);
    refresh();
  });
  el("bg-clear").addEventListener("click", () => {
    ed.fires.clear();
    ed.glyphs.clear();
    ed.player = idxOf(def.player);
    ed.doubles = 0;
    clearPlan();
    message("");
    refresh();
  });
  el("bg-prev").addEventListener("click", () => {
    ui.step = Math.max(0, ui.step - 1);
    refresh();
  });
  el("bg-next").addEventListener("click", () => {
    ui.step = Math.min(ui.plan ? ui.plan.path.length : 0, ui.step + 1);
    refresh();
  });
  el("bg-from-here").addEventListener("click", () => {
    if (!ui.plan) {
      return;
    }
    const s = ui.plan.states[ui.step];
    ed.player = s.p;
    ed.fires = new Set(s.fires);
    ed.glyphs = new Set(s.glyphs || []);
    ed.turn = s.turn;
    ed.pv = s.pv;
    ed.pa = s.pa;
    ed.doubles = s.doubles;
    clearPlan();
    message("Position reprise à cette étape: corrige la carte si besoin, puis recalcule.", true);
    refresh();
  });

  // ---- Calcul ----
  function stop() {
    if (ui.worker) {
      ui.worker.terminate();
      ui.worker = null;
    }
    ui.busy = false;
    el("bg-stop").hidden = true;
  }
  el("bg-stop").addEventListener("click", () => {
    stop();
    message("Calcul annulé.");
    refresh();
  });

  function replay(start, path) {
    const states = [start];
    const kills = [];
    let state = start;
    for (const action of path) {
      const next = E.apply(ctx, state, action);
      if (!next) {
        return null;
      }
      kills.push(next.fires.length < state.fires.length);
      states.push(next);
      state = next;
    }
    return { states, kills };
  }

  el("bg-solve").addEventListener("click", () => {
    if (ui.busy || !ed.fires.size) {
      return;
    }
    clearPlan();
    ui.busy = true;
    el("bg-stop").hidden = false;
    const effort = el("bg-effort").value;
    const budgetMs = effort === "rapide" ? 25000 : effort === "normal" ? 90000 : 200000;
    const start = { p: ed.player, fires: [...ed.fires], glyphs: [...ed.glyphs], pv: ed.pv, pa: ed.pa, doubles: ed.doubles, turn: ed.turn };
    message("Recherche en cours…");
    refresh();
    try {
      ui.worker = new Worker("assets/js/bolgrot/worker.js");
    } catch (error) {
      stop();
      message("Ton navigateur ne peut pas lancer le calcul (Worker indisponible).");
      refresh();
      return;
    }
    ui.worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "progress") {
        message(`Recherche ${data.stage}/${data.stages} (${data.label}): couche ${data.layer}, ${data.fires} feux restants dans le meilleur essai…`);
        return;
      }
      stop();
      if (!data.path) {
        message("Aucun plan trouvé. La position est peut-être perdue; vérifie la carte ou essaie l'effort « approfondi ».");
        refresh();
        return;
      }
      const played = replay(start, data.path);
      if (!played) {
        message("Le plan trouvé n'a pas pu être rejoué: signale-le.");
        refresh();
        return;
      }
      ui.plan = { path: data.path, states: played.states, kills: played.kills };
      ui.step = 0;
      message("Plan trouvé: parcours-le avec ◀ ▶ ou en cliquant une action.", true);
      refresh();
    };
    ui.worker.onerror = () => {
      stop();
      message("Erreur pendant le calcul.");
      refresh();
    };
    ui.worker.postMessage({ def, state: start, effort, budgetMs });
  });

  // ---- Import d'une capture d'écran ----
  async function importImage(blob) {
    if (ui.busy || !blob) {
      return;
    }
    message("Lecture de la capture…");
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, 2400 / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
      ctx2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const read = window.TnulBolgrotCapture.analyze({ data: pixels.data, width: canvas.width, height: canvas.height }, def);
      if (!read.ok) {
        message(read.reason);
        return;
      }
      clearPlan();
      ed.fires = new Set(read.fires.filter((i) => i !== read.player));
      ed.glyphs = new Set(read.glyphs);
      if (read.glyphs.length) {
        ed.turn = 6;
        ed.pv = Math.max(ed.pv, 40);
      } else if (ed.turn === 6 && !read.glyphs.length) {
        ed.turn = 7;
        ed.pv = Math.min(ed.pv, 40);
      }
      if (read.player !== null) {
        ed.player = read.player;
      }
      ed.doubles = 0;
      message(`Capture lue: ${read.fires.length} feux, ${read.glyphs.length} glyphes${read.player === null ? ", position non trouvée (clique ta case)" : ""}. Vérifie la carte, règle PV et PA, puis calcule.`, true);
      refresh();
    } catch (error) {
      console.error(error);
      message("Impossible de lire cette image.");
    }
  }
  el("bg-import").addEventListener("click", () => el("bg-file").click());
  el("bg-file").addEventListener("change", (event) => {
    importImage(event.target.files[0]);
    event.target.value = "";
  });
  document.addEventListener("paste", (event) => {
    const item = [...(event.clipboardData ? event.clipboardData.items : [])].find((entry) => entry.type.startsWith("image/"));
    if (item) {
      event.preventDefault();
      importImage(item.getAsFile());
    }
  });
  const dropZone = board.closest(".bg-board-wrap");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    if (name === "drop") {
      const file = [...event.dataTransfer.files].find((entry) => entry.type.startsWith("image/"));
      importImage(file);
    }
  }));

  refresh();
})();
