// Page d'aide au combat de la Rainikrone: peinture de la grille, calcul des bonds, relecture pas à pas.
(async function () {
  const R = window.TnulRainikroneEngine;
  const SX = 30;
  const SY = 15;
  const SIDE = 10;
  const SVG_NS = "http://www.w3.org/2000/svg";
  // Flèches vues à l'écran: Nord en haut à droite, Est en bas à droite, Sud en bas à gauche, Ouest en haut à gauche.
  const ARROW = { N: "↗", E: "↘", S: "↙", W: "↖" };
  const ARROW_NAME = { N: "haut-droite", E: "bas-droite", S: "bas-gauche", W: "haut-gauche" };
  const COLOR_LABEL = ["", "J", "R", "V", "N", "★"];
  const COLOR_NAME = ["vide", "jaune", "rouge", "vert", "noir", "rose"];
  const COLOR_FILL = ["#76829f", "#f5b301", "#e5484d", "#2fb67c", "#15181f", "#e879b9"];

  const el = (id) => document.getElementById(id);
  const board = el("rk-board");

  let def;
  try {
    def = await fetch("data/rainikrone.json").then((response) => response.json());
  } catch (error) {
    board.replaceWith(Object.assign(document.createElement("p"), { textContent: "Impossible de charger la grille." }));
    console.error("Erreur de chargement:", error.message);
    return;
  }
  const geo = R.parse(def);
  const { rows, cols } = geo;
  const total = rows * cols;
  const editable = [];
  for (let i = 0; i < total; i += 1) {
    if (!geo.walls[i] && i !== geo.start && !geo.pinks.includes(i)) {
      editable.push(i);
    }
  }
  const rcOf = (i) => [(i / cols) | 0, i % cols];
  const toXY = (i) => {
    const [r, c] = rcOf(i);
    return { x: (c - r) * SX, y: (c + r) * SY };
  };

  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) {
      parent.appendChild(node);
    }
    return node;
  };
  const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");

  const ed = { colors: new Array(total).fill(0), start: geo.start, brush: 1 };
  geo.pinks.forEach((p) => { ed.colors[p] = R.PINK; });
  const ui = { plan: null, step: 0, worker: null, busy: false, painting: false, erasing: false, uncertain: new Set() };

  // ---- Outils de peinture ----
  [1, 2, 3, 4].forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rk-tool";
    button.dataset.color = String(color);
    const swatch = document.createElement("span");
    swatch.className = "rk-swatch";
    swatch.style.background = COLOR_FILL[color];
    const key = document.createElement("kbd");
    key.textContent = String(color);
    key.style.opacity = "0.6";
    button.append(swatch, COLOR_NAME[color].charAt(0).toUpperCase() + COLOR_NAME[color].slice(1), key);
    button.addEventListener("click", () => {
      ed.brush = color;
      renderTools();
    });
    el("rk-tools").appendChild(button);
  });
  function renderTools() {
    document.querySelectorAll(".rk-tool").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.color) === ed.brush));
    });
  }
  document.addEventListener("keydown", (event) => {
    if (/^[1-4]$/.test(event.key) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      ed.brush = Number(event.key);
      renderTools();
    }
  });

  // ---- Carte ----
  const open = [];
  for (let i = 0; i < total; i += 1) {
    if (!geo.walls[i]) open.push(i);
  }
  const xs = open.map((i) => toXY(i).x);
  const ys = open.map((i) => toXY(i).y);
  const minX = Math.min(...xs) - SX;
  const maxX = Math.max(...xs) + SX;
  const minY = Math.min(...ys) - SY - 16;
  const maxY = Math.max(...ys) + SY + SIDE;
  board.setAttribute("viewBox", `${minX - 4} ${minY - 4} ${maxX - minX + 8} ${maxY - minY + 8}`);
  const slabLayer = svg("g", {}, board);
  const cellLayer = svg("g", {}, board);
  const topLayer = svg("g", {}, board);
  const cellNodes = new Map();
  const labelNodes = new Map();

  const isOpen = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && !geo.walls[r * cols + c];
  open.forEach((i) => {
    const { x, y } = toXY(i);
    const [r, c] = rcOf(i);
    if (!isOpen(r + 1, c)) {
      svg("polygon", { class: "rk-slab-l", points: pts([[x - SX, y], [x, y + SY], [x, y + SY + SIDE], [x - SX, y + SIDE]]) }, slabLayer);
    }
    if (!isOpen(r, c + 1)) {
      svg("polygon", { class: "rk-slab-r", points: pts([[x, y + SY], [x + SX, y], [x + SX, y + SIDE], [x, y + SY + SIDE]]) }, slabLayer);
    }
    const cell = svg("polygon", { class: "rk-cell", points: pts([[x, y - SY], [x + SX, y], [x, y + SY], [x - SX, y]]) }, cellLayer);
    cell.dataset.i = String(i);
    cellNodes.set(i, cell);
    labelNodes.set(i, svg("text", { class: "rk-label", x, y: y + 3.5 }, cellLayer));
  });
  // Cases bloquées: de petits blocs, pour montrer où l'on ne peut pas passer.
  for (let i = 0; i < total; i += 1) {
    if (!geo.walls[i]) continue;
    const { x, y } = toXY(i);
    const up = y - 10;
    const g = svg("g", {}, cellLayer);
    svg("polygon", { class: "rk-wall-l", points: pts([[x - SX, up], [x, up + SY], [x, y + SY], [x - SX, y]]) }, g);
    svg("polygon", { class: "rk-wall-r", points: pts([[x + SX, up], [x, up + SY], [x, y + SY], [x + SX, y]]) }, g);
    svg("polygon", { class: "rk-wall-top", points: pts([[x - SX, up], [x, up - SY], [x + SX, up], [x, up + SY]]) }, g);
  }

  // ---- Affichage ----
  function viewState() {
    if (ui.plan && ui.step > 0) {
      return ui.plan.states[ui.step];
    }
    return { pos: ed.start, grid: Uint8Array.from(ed.colors), traj: [ed.start], pinks: geo.pinks.filter((p) => ed.colors[p] === R.PINK) };
  }

  function draw() {
    const view = viewState();
    const trail = new Set();
    if (ui.plan && ui.step > 0) {
      ui.plan.states.slice(0, ui.step + 1).forEach((s) => trail.add(s.pos));
    }
    const target = ui.plan && ui.step > 0 ? ui.plan.targets[ui.step - 1] : -1;
    cellNodes.forEach((node, i) => {
      const color = view.grid[i];
      node.setAttribute("class", `rk-cell c${color || 0}` + ((rcOf(i)[1] - rcOf(i)[0]) % 2 ? " alt" : "") + (trail.has(i) ? " trail" : "") + (i === target ? " target" : "") + (ui.uncertain.has(i) && ui.step === 0 ? " doubt" : ""));
      const label = labelNodes.get(i);
      label.textContent = COLOR_LABEL[color];
      label.setAttribute("class", "rk-label" + (color === 4 || color === 2 || color === 3 ? " light" : ""));
    });
    topLayer.innerHTML = "";
    const { x, y } = toXY(view.pos);
    const g = svg("g", { class: "rk-player" }, topLayer);
    svg("ellipse", { class: "rk-player-shadow", cx: x, cy: y + 3, rx: 11, ry: 5 }, g);
    svg("circle", { class: "rk-player-body", cx: x, cy: y - 8, r: 8 }, g);
  }

  function renderPlan() {
    el("rk-plan-card").hidden = !ui.plan;
    const list = el("rk-plan");
    list.innerHTML = "";
    if (!ui.plan) {
      return;
    }
    ui.plan.path.forEach((dir, index) => {
      const item = document.createElement("li");
      if (ui.step === index + 1) {
        item.classList.add("current");
      }
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = ARROW[dir];
      const text = document.createElement("span");
      text.textContent = `${dir === "N" ? "Nord" : dir === "E" ? "Est" : dir === "S" ? "Sud" : "Ouest"} (${ARROW_NAME[dir]})`;
      const landing = document.createElement("span");
      landing.className = "landing";
      const landed = ui.plan.landings[index];
      const swatch = document.createElement("span");
      swatch.className = "rk-swatch";
      swatch.style.background = COLOR_FILL[landed];
      landing.append("sur", swatch);
      item.append(arrow, text, landing);
      item.addEventListener("click", () => {
        ui.step = index + 1;
        refresh();
      });
      list.appendChild(item);
      if (ui.step === index + 1) {
        requestAnimationFrame(() => item.scrollIntoView({ block: "nearest" }));
      }
    });
    el("rk-summary").textContent = `${ui.plan.path.length} bonds pour activer les 4 glyphes roses.`;
  }

  function renderStepBar() {
    const count = ui.plan ? ui.plan.path.length : 0;
    el("rk-prev").disabled = ui.step === 0;
    el("rk-next").disabled = ui.step >= count;
    const view = viewState();
    el("rk-step-label").textContent = (ui.step === 0 ? "Grille de départ" : `Bond ${ui.step}/${count}`) + ` · ${4 - view.pinks.length}/4 roses`;
  }

  function filled() {
    return editable.filter((i) => ed.colors[i] >= 1 && ed.colors[i] <= 4).length;
  }
  function refresh() {
    draw();
    renderPlan();
    renderStepBar();
    renderTools();
    el("rk-count").textContent = `${filled()} / ${editable.length} cases renseignées`;
    el("rk-solve").disabled = ui.busy || filled() < editable.length;
  }
  function message(text, ok) {
    const node = el("rk-message");
    node.textContent = text || "";
    node.classList.toggle("ok", Boolean(ok));
  }
  function clearPlan() {
    ui.plan = null;
    ui.step = 0;
  }

  // ---- Peinture ----
  function paint(i, color) {
    if (ui.busy || !editable.includes(i)) {
      return;
    }
    if (ed.colors[i] === color) {
      return;
    }
    ed.colors[i] = color;
    ui.uncertain.delete(i);
    clearPlan();
    message("");
    refresh();
  }
  const cellOf = (node) => (node && node.dataset && node.dataset.i !== undefined ? Number(node.dataset.i) : null);
  board.addEventListener("pointerdown", (event) => {
    const i = cellOf(event.target);
    if (i === null || ui.step !== 0) {
      return;
    }
    event.preventDefault();
    ui.painting = true;
    ui.erasing = event.button === 2;
    paint(i, ui.erasing ? 0 : ed.brush);
  });
  board.addEventListener("pointermove", (event) => {
    if (!ui.painting) {
      return;
    }
    const i = cellOf(document.elementFromPoint(event.clientX, event.clientY));
    if (i !== null) {
      paint(i, ui.erasing ? 0 : ed.brush);
    }
  });
  window.addEventListener("pointerup", () => { ui.painting = false; });
  board.addEventListener("contextmenu", (event) => event.preventDefault());

  el("rk-random").addEventListener("click", () => {
    if (ui.busy) return;
    editable.forEach((i) => { ed.colors[i] = 1 + Math.floor(Math.random() * 4); });
    ed.start = geo.start;
    clearPlan();
    message("");
    refresh();
  });
  el("rk-clear").addEventListener("click", () => {
    if (ui.busy) return;
    editable.forEach((i) => { ed.colors[i] = 0; });
    geo.pinks.forEach((p) => { ed.colors[p] = R.PINK; });
    ed.start = geo.start;
    clearPlan();
    message("");
    refresh();
  });
  el("rk-prev").addEventListener("click", () => {
    ui.step = Math.max(0, ui.step - 1);
    refresh();
  });
  el("rk-next").addEventListener("click", () => {
    ui.step = Math.min(ui.plan ? ui.plan.path.length : 0, ui.step + 1);
    refresh();
  });
  el("rk-from-here").addEventListener("click", () => {
    if (!ui.plan) return;
    const s = ui.plan.states[ui.step];
    ed.colors = Array.from(s.grid);
    ed.start = s.pos;
    clearPlan();
    message("Grille reprise à cette étape: corrige les couleurs si besoin, puis recalcule.", true);
    refresh();
  });

  // ---- Calcul ----
  function stop() {
    if (ui.worker) {
      ui.worker.terminate();
      ui.worker = null;
    }
    ui.busy = false;
    el("rk-stop").hidden = true;
  }
  el("rk-stop").addEventListener("click", () => {
    stop();
    message("Calcul annulé.");
    refresh();
  });

  function replay(path) {
    const start = R.initial(geo, ed.colors, ed.start);
    const states = [start];
    const targets = [];
    const landings = [];
    let state = start;
    for (const dir of path) {
      const [dr, dc] = R.DIRS[dir];
      const [r, c] = rcOf(state.pos);
      const target = (r + dr) * cols + (c + dc);
      landings.push(state.grid[target]);
      targets.push(target);
      const next = R.jump(geo, state, dir);
      if (!next) {
        return null;
      }
      states.push(next);
      state = next;
    }
    return { states, targets, landings };
  }

  el("rk-solve").addEventListener("click", () => {
    if (ui.busy) return;
    clearPlan();
    ui.busy = true;
    el("rk-stop").hidden = false;
    message("Recherche en cours…");
    refresh();
    try {
      ui.worker = new Worker("assets/js/rainikrone/worker.js");
    } catch (error) {
      stop();
      message("Ton navigateur ne peut pas lancer le calcul (Worker indisponible).");
      refresh();
      return;
    }
    ui.worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "progress") {
        message(`Recherche (largeur ${data.beam})…`);
        return;
      }
      stop();
      if (!data.path) {
        message("Aucune suite de bonds trouvée. Vérifie les couleurs de la grille.");
        refresh();
        return;
      }
      const played = replay(data.path);
      if (!played) {
        message("La suite trouvée n'a pas pu être rejouée: signale-le.");
        refresh();
        return;
      }
      ui.plan = { path: data.path, ...played };
      ui.step = 0;
      message("Bonds trouvés: parcours-les avec ◀ ▶ ou en cliquant un bond.", true);
      refresh();
    };
    ui.worker.onerror = () => {
      stop();
      message("Erreur pendant le calcul.");
      refresh();
    };
    ui.worker.postMessage({ def, colors: ed.colors, start: ed.start });
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
      const read = window.TnulRainikroneCapture.analyze({ data: pixels.data, width: canvas.width, height: canvas.height }, def);
      if (!read.ok) {
        message(read.reason);
        return;
      }
      clearPlan();
      ed.start = geo.start;
      ed.colors = read.colors.slice();
      ui.uncertain = new Set(read.uncertain);
      message(`Capture lue: ${read.counted} cases.${read.uncertain.length ? ` ${read.uncertain.length} case(s) douteuse(s) cerclées en blanc: vérifie-les et corrige si besoin.` : " Vérifie la grille avant de calculer."}`, true);
      refresh();
    } catch (error) {
      console.error(error);
      message("Impossible de lire cette image.");
    }
  }
  el("rk-import").addEventListener("click", () => el("rk-file").click());
  el("rk-file").addEventListener("change", (event) => {
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
  const dropZone = board.closest(".rk-board-wrap");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    if (name === "drop") {
      importImage([...event.dataTransfer.files].find((entry) => entry.type.startsWith("image/")));
    }
  }));

  refresh();
})();
