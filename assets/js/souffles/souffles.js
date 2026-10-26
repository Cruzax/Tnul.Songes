// Page « Les Souffles du Reflet »: carte du Jardin paradoxal, placement des Souffles, plan calculé par
// assets/js/souffles/solver.js (dans worker.js) et rejoué coup par coup.
(async function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STEP_X = 22;
  const STEP_Y = 11;
  const ROCK_HEIGHT = 8;
  const SIDE = 6;
  const STORAGE_KEY = "tnul-souffles";
  const ARROWS = { "1,0": "↘", "-1,0": "↖", "0,1": "↙", "0,-1": "↗" };
  const TOOLS = [
    { id: "n", label: "Souffle noir" },
    { id: "b", label: "Souffle blanc" },
    { id: "p", label: "Ma position" },
    { id: "x", label: "Effacer" },
  ];

  const board = document.getElementById("sf-board");
  const label = document.getElementById("sf-step-label");
  const prev = document.getElementById("sf-prev");
  const next = document.getElementById("sf-next");
  const message = document.getElementById("sf-message");
  const solveButton = document.getElementById("sf-solve");
  const planCard = document.getElementById("sf-plan-card");
  const planNode = document.getElementById("sf-plan");

  let guide;
  try {
    guide = await fetch("data/souffles.json").then((response) => response.json());
  } catch (error) {
    message.textContent = "Impossible de charger la carte.";
    console.error("Erreur de chargement:", error.message);
    return;
  }

  // Disposition en cours (modifiable), gardée dans le navigateur
  const fresh = () => ({ player: guide.player.slice(), souffles: guide.souffles.map((s) => ({ ...s, cell: s.cell.slice() })) });
  let layout = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.souffles) && Array.isArray(saved.player)) layout = saved;
  } catch (error) {
    // stockage indisponible: carte du guide
  }
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
      // sans importance
    }
  };

  const def = () => ({ ...guide, player: layout.player, souffles: layout.souffles });
  const state = { tool: "n", plan: null, frames: [], step: 0, anchor: null, unsure: new Set() };
  const game = SouffleSolver.makeGame(guide);
  const key = (a, b) => `${a},${b}`;
  const screen = (a, b) => ({ x: (a - b) * STEP_X, y: (a + b) * STEP_Y });
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) parent.appendChild(node);
    return node;
  };
  const points = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");
  const diamond = (x, y) => points([[x, y - STEP_Y], [x + STEP_X, y], [x, y + STEP_Y], [x - STEP_X, y]]);

  const cells = [];
  guide.map.rows.forEach((row, line) => {
    [...row].forEach((ch, column) => {
      if (ch !== " ") cells.push({ a: guide.map.amin + column, b: guide.map.bmin + line, wall: ch === "#" });
    });
  });
  cells.sort((p, q) => (p.a + p.b) - (q.a + q.b) || (p.a - p.b) - (q.a - q.b));
  const known = new Set(cells.map((c) => key(c.a, c.b)));

  // Dessin: carte, puis Souffles et joueur de l'étape affichée (départ ou après un coup du plan)
  function draw() {
    const view = state.frames[state.step] || { player: layout.player, souffles: layout.souffles };
    const action = state.step ? state.plan.path[state.step - 1] : null;
    board.textContent = "";
    const xs = cells.map((c) => screen(c.a, c.b).x);
    const ys = cells.map((c) => screen(c.a, c.b).y);
    board.setAttribute("viewBox", [Math.min(...xs) - STEP_X - 4, Math.min(...ys) - STEP_Y - ROCK_HEIGHT - 4, Math.max(...xs) - Math.min(...xs) + STEP_X * 2 + 8, Math.max(...ys) - Math.min(...ys) + STEP_Y * 2 + ROCK_HEIGHT + SIDE + 8].join(" "));
    const slabs = svg("g", {}, board);
    const floor = svg("g", {}, board);
    const top = svg("g", {}, board);
    cells.forEach(({ a, b, wall }) => {
      const { x, y } = screen(a, b);
      if (!known.has(key(a, b + 1))) svg("polygon", { class: "sf-side-l", points: points([[x - STEP_X, y], [x, y + STEP_Y], [x, y + STEP_Y + SIDE], [x - STEP_X, y + SIDE]]) }, slabs);
      if (!known.has(key(a + 1, b))) svg("polygon", { class: "sf-side-r", points: points([[x, y + STEP_Y], [x + STEP_X, y], [x + STEP_X, y + SIDE], [x, y + STEP_Y + SIDE]]) }, slabs);
      const cell = svg("polygon", { class: "sf-cell" + ((a + b) % 2 ? " alt" : ""), points: diamond(x, y) }, floor);
      cell.dataset.a = a;
      cell.dataset.b = b;
      if (state.anchor && state.anchor[0] === a && state.anchor[1] === b) cell.classList.add("sf-anchor");
      if (state.unsure.has(key(a, b))) cell.classList.add("sf-unsure");
      if (wall) {
        const t = y - ROCK_HEIGHT;
        svg("polygon", { class: "sf-grass-l", points: points([[x - STEP_X, t], [x, t + STEP_Y], [x, y + STEP_Y], [x - STEP_X, y]]) }, top);
        svg("polygon", { class: "sf-grass-r", points: points([[x, t + STEP_Y], [x + STEP_X, t], [x + STEP_X, y], [x, y + STEP_Y]]) }, top);
        svg("polygon", { class: "sf-grass-top", points: diamond(x, t) }, top);
      }
    });

    // Coup affiché: cible entourée, case d'arrivée et cases dont la couleur a changé
    const pieces = [];
    const before = state.step ? state.frames[state.step - 1] : null;
    view.souffles.forEach((s) => {
      const changed = before && before.souffles.find((o) => o.id === s.id).color !== s.color;
      pieces.push({ ...s, kind: "souffle", changed, target: action && action.id === s.id });
    });
    pieces.push({ kind: "player", cell: view.player });
    pieces.sort((p, q) => (p.cell[0] + p.cell[1]) - (q.cell[0] + q.cell[1]));
    pieces.forEach((piece) => {
      const { x, y } = screen(...piece.cell);
      const group = svg("g", { class: "sf-piece" }, top);
      svg("ellipse", { class: "sf-shadow", cx: x, cy: y + 1, rx: 8, ry: 4 }, group);
      if (piece.kind === "player") {
        svg("circle", { class: "sf-player", cx: x, cy: y - 8, r: 6.5 }, group);
        svg("title", {}, group).textContent = "Toi";
        return;
      }
      if (piece.target) svg("polygon", { class: "sf-target", points: diamond(x, y) }, group);
      svg("path", { class: `sf-souffle ${piece.color === "n" ? "black" : "white"}${piece.changed ? " changed" : ""}`, d: `M${x - 5.5} ${y} Q${x - 6.5} ${y - 13} ${x} ${y - 17} Q${x + 6.5} ${y - 13} ${x + 5.5} ${y} Z` }, group);
      svg("text", { class: "sf-id", x, y: y - 6, "text-anchor": "middle" }, group).textContent = piece.id;
      svg("title", {}, group).textContent = `Souffle ${piece.id} (${piece.color === "n" ? "noir" : "blanc"})`;
    });

    if (state.anchor) {
      const { x, y } = screen(...state.anchor);
      svg("circle", { class: "sf-anchor-ring", cx: x, cy: y, r: 26 }, top);
    }

    const black = view.souffles.filter((s) => s.color === "n").length;
    document.getElementById("sf-count").textContent = `${black} noirs · ${view.souffles.length - black} blancs`;
    label.textContent = state.step ? `Coup ${state.step} / ${state.plan.path.length}` : "Départ";
    prev.disabled = state.step === 0;
    next.disabled = !state.plan || state.step >= state.plan.path.length;
    planNode.querySelectorAll("li[data-step]").forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle("is-current", n === state.step);
      item.classList.toggle("is-done", n < state.step);
    });
  }

  // Texte d'un coup: sort, Souffle visé et direction à l'écran
  function describe(action, frame) {
    const arrow = (from, to) => ARROWS[`${Math.sign(to[0] - from[0])},${Math.sign(to[1] - from[1])}`] || "";
    if (action.type === "move") return `Avance d'une case ${arrow(frame.player, action.to)}`;
    const target = frame.souffles.find((s) => s.id === action.id);
    const color = target.color === "n" ? "noir" : "blanc";
    if (action.type === "vib") return `Vibration Paradoxale ${arrow(frame.player, target.cell)} sur le Souffle ${action.id} (${color})`;
    return `Réciprocité sur le Souffle ${action.id} (${color})`;
  }

  function showPlan(result) {
    state.plan = result;
    state.frames = [{ player: layout.player, souffles: layout.souffles }];
    let s = SouffleSolver.initialState(def());
    result.path.forEach((action) => {
      // Les index du plan correspondent à l'ordre des Souffles, inchangé pendant la recherche
      s = SouffleSolver.apply(game, s, action);
      state.frames.push({ player: s.player, souffles: s.souffles });
    });
    planNode.textContent = "";
    let turn = 1;
    const head = (n) => {
      const item = document.createElement("li");
      item.className = "sf-turn";
      item.textContent = `Tour ${n}`;
      planNode.appendChild(item);
    };
    head(turn);
    let empty = true;
    const pass = () => {
      const item = document.createElement("li");
      item.className = "sf-pass";
      item.textContent = "Passe ton tour (la Réciprocité se recharge)";
      planNode.appendChild(item);
    };
    result.path.forEach((action, index) => {
      if (action.type === "end") {
        if (empty) pass();
        turn += 1;
        head(turn);
        empty = true;
        return;
      }
      empty = false;
      const item = document.createElement("li");
      item.dataset.step = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = describe(action, state.frames[index]);
      button.addEventListener("click", () => {
        state.step = index + 1;
        draw();
      });
      item.appendChild(button);
      planNode.appendChild(item);
    });
    planCard.hidden = false;
    message.textContent = `Tout en ${result.color === "n" ? "noir" : "blanc"} en ${turn} tours, il te restera ${result.hp} PV.`;
    state.step = 0;
    draw();
  }

  function clearPlan() {
    state.plan = null;
    state.frames = [];
    state.step = 0;
    planCard.hidden = true;
    message.textContent = "";
  }

  // Placement: clic = outil choisi, clic droit = vider la case
  function place(a, b, tool) {
    if (!game.floor.has(key(a, b))) return;
    state.unsure.delete(key(a, b));
    const index = layout.souffles.findIndex((s) => s.cell[0] === a && s.cell[1] === b);
    const isPlayer = layout.player[0] === a && layout.player[1] === b;
    if (tool === "p") {
      if (index >= 0) return;
      layout.player = [a, b];
    } else if (tool === "x") {
      if (index >= 0) layout.souffles.splice(index, 1);
    } else if (!isPlayer) {
      if (index >= 0) layout.souffles[index].color = tool;
      else layout.souffles.push({ id: Math.max(0, ...layout.souffles.map((s) => s.id)) + 1, cell: [a, b], color: tool });
    }
    save();
    clearPlan();
    draw();
  }
  board.addEventListener("click", (event) => {
    const cell = event.target.closest(".sf-cell");
    if (cell) place(Number(cell.dataset.a), Number(cell.dataset.b), state.tool);
  });
  board.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".sf-cell");
    if (!cell) return;
    event.preventDefault();
    place(Number(cell.dataset.a), Number(cell.dataset.b), "x");
  });

  const toolbar = document.getElementById("sf-tools");
  TOOLS.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sf-tool tool-${tool.id}`;
    button.innerHTML = `<i aria-hidden="true"></i>`;
    button.append(tool.label);
    button.setAttribute("aria-pressed", String(tool.id === state.tool));
    button.addEventListener("click", () => {
      state.tool = tool.id;
      toolbar.querySelectorAll(".sf-tool:not(.sf-import)").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
    toolbar.appendChild(button);
  });

  // Lecture d'une capture: 3 repères (coins des blocs d'herbe), puis ta position; voir assets/js/lib/capture-grid.js
  const ANCHORS = [
    { cell: [-3, 3], label: "Clique sur la case juste sous le coin bas du bloc d'herbe de gauche (cerclée en bleu sur la mini-carte)." },
    { cell: [3, 3], label: "Clique sur la case juste sous le coin bas du bloc d'herbe du milieu (cerclée en bleu sur la mini-carte)." },
    { cell: [6, -7], label: "Clique sur la case juste au-dessus du bloc d'herbe de droite (cerclée en bleu sur la mini-carte)." },
  ];
  CaptureGrid.listen({
    button: document.getElementById("sf-import"),
    drop: board,
    onImage: (image) => CaptureGrid.open({
      image,
      anchors: ANCHORS,
      extra: [{ label: "Clique sur ta case (ton personnage)." }],
      highlight: (cell) => {
        state.anchor = cell || null;
        draw();
      },
      preview: () => board.cloneNode(true),
      done: (sample, [player]) => {
        const read = SouffleCapture.read(sample, guide);
        const unsure = new Set(read.unsure.map((c) => key(...c)));
        // Aux cases douteuses du bord, on garde ce qui était déjà placé
        const kept = layout.souffles.filter((s) => unsure.has(key(...s.cell)));
        const souffles = [...read.souffles.filter((s) => !unsure.has(key(...s.cell))), ...kept].map((s, i) => ({ id: i + 1, cell: s.cell, color: s.color }));
        layout = { player: game.floor.has(key(...player)) ? player : layout.player, souffles };
        state.unsure = unsure;
        save();
        clearPlan();
        draw();
        const black = souffles.filter((s) => s.color === "n").length;
        message.textContent = `${souffles.length} Souffles lus (${black} noirs, ${souffles.length - black} blancs). Vérifie la carte avant de calculer`
          + (unsure.size ? ` : les cases hachurées du bord sont difficiles à lire, ce qui y était placé est gardé.` : ".");
      },
    }),
  });

  let worker = null;
  solveButton.addEventListener("click", () => {
    if (worker) worker.terminate();
    clearPlan();
    message.textContent = "Calcul en cours (quelques secondes)…";
    solveButton.disabled = true;
    worker = new Worker("assets/js/souffles/worker.js");
    worker.onmessage = (event) => {
      solveButton.disabled = false;
      worker.terminate();
      worker = null;
      if (event.data) showPlan(event.data);
      else message.textContent = "Aucune solution trouvée avec tes PV : vérifie la carte (couleurs, position).";
    };
    worker.postMessage({ def: def(), firstOnly: document.getElementById("sf-first").checked });
  });
  document.getElementById("sf-reset").addEventListener("click", () => {
    layout = fresh();
    save();
    clearPlan();
    draw();
  });
  prev.addEventListener("click", () => { if (state.step > 0) { state.step--; draw(); } });
  next.addEventListener("click", () => { if (state.plan && state.step < state.plan.path.length) { state.step++; draw(); } });
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;
    if (event.key === "ArrowLeft") prev.click();
    if (event.key === "ArrowRight") next.click();
  });

  draw();
})();
