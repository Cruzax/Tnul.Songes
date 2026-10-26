// Page « Les boules élémentaires »: carte d'exemple modifiable, plan calculé par assets/js/boules/solver.js
// (dans un worker) et rejoué coup par coup.
(async function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STEP_X = 22;
  const STEP_Y = 11;
  const ROCK = 8;
  const SIDE = 6;
  const STORAGE_KEY = "tnul-boules";
  const ARROWS = { "1,0": "↘", "-1,0": "↖", "0,1": "↙", "0,-1": "↗" };

  const board = document.getElementById("bl-board");
  const label = document.getElementById("bl-step-label");
  const prev = document.getElementById("bl-prev");
  const next = document.getElementById("bl-next");
  const message = document.getElementById("bl-message");
  const solveButton = document.getElementById("bl-solve");
  const planCard = document.getElementById("bl-plan-card");
  const planNode = document.getElementById("bl-plan");

  let example;
  try {
    example = await fetch("data/boules.json").then((response) => response.json());
  } catch (error) {
    message.textContent = "Impossible de charger la carte.";
    console.error("Erreur de chargement:", error.message);
    return;
  }

  let def = structuredClone(example);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.map && Array.isArray(saved.balls)) def = saved;
  } catch (error) {
    // stockage indisponible: exemple
  }
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
    } catch (error) {
      // sans importance
    }
  };

  const state = { color: 0, mode: "small", plan: null, frames: [], step: 0, anchor: null };
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
  const charAt = (a, b) => (def.map.rows[b - def.map.bmin] || "")[a - def.map.amin] || " ";

  function draw() {
    const game = BallSolver.makeGame(def);
    const view = state.frames[state.step] || def.balls.map((b) => b.small);
    const hit = state.step ? state.plan.path[state.step - 1] : null;
    board.textContent = "";
    const cells = [];
    def.map.rows.forEach((row, line) => [...row].forEach((ch, column) => {
      if (ch !== " ") cells.push({ a: def.map.amin + column, b: def.map.bmin + line, wall: ch === "#" });
    }));
    cells.sort((p, q) => (p.a + p.b) - (q.a + q.b) || (p.a - p.b) - (q.a - q.b));
    const xs = cells.map((c) => screen(c.a, c.b).x);
    const ys = cells.map((c) => screen(c.a, c.b).y);
    board.setAttribute("viewBox", [Math.min(...xs) - STEP_X - 4, Math.min(...ys) - STEP_Y - 26, Math.max(...xs) - Math.min(...xs) + STEP_X * 2 + 8, Math.max(...ys) - Math.min(...ys) + STEP_Y * 2 + SIDE + 30].join(" "));
    const slabs = svg("g", {}, board);
    const floor = svg("g", {}, board);
    const top = svg("g", {}, board);
    cells.forEach(({ a, b, wall }) => {
      const { x, y } = screen(a, b);
      if (charAt(a, b + 1) === " ") svg("polygon", { class: "sf-side-l", points: points([[x - STEP_X, y], [x, y + STEP_Y], [x, y + STEP_Y + SIDE], [x - STEP_X, y + SIDE]]) }, slabs);
      if (charAt(a + 1, b) === " ") svg("polygon", { class: "sf-side-r", points: points([[x, y + STEP_Y], [x + STEP_X, y], [x + STEP_X, y + SIDE], [x, y + STEP_Y + SIDE]]) }, slabs);
      const k = key(a, b);
      const glyph = game.glyphOf.get(k);
      const cell = svg("polygon", { class: game.holes.has(k) ? "bl-hole" : `bl-cell${(a + b) % 2 ? " alt" : ""}`, points: diamond(x, y) }, floor);
      if (glyph !== undefined) cell.setAttribute("style", `fill:${def.balls[glyph].hex};fill-opacity:0.45`);
      cell.dataset.a = a;
      cell.dataset.b = b;
      if (state.anchor && state.anchor[0] === a && state.anchor[1] === b) cell.classList.add("mc-anchor");
      if (wall) {
        const t = y - ROCK;
        svg("polygon", { class: "bl-rock-l", points: points([[x - STEP_X, t], [x, t + STEP_Y], [x, y + STEP_Y], [x - STEP_X, y]]) }, top);
        svg("polygon", { class: "bl-rock-r", points: points([[x, t + STEP_Y], [x + STEP_X, t], [x + STEP_X, y], [x, y + STEP_Y]]) }, top);
        svg("polygon", { class: "bl-rock-top", points: diamond(x, t) }, top);
      }
    });

    // Direction du coup affiché: les 4 glyphes blancs autour de toi, celui choisi en surbrillance
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => {
      const { x, y } = screen(def.player[0] + d[0], def.player[1] + d[1]);
      const chosen = hit && hit.dir[0] === d[0] && hit.dir[1] === d[1];
      svg("polygon", { class: "bl-white" + (chosen ? " chosen" : ""), points: diamond(x, y) }, floor);
    });

    const pieces = [{ kind: "player", cell: def.player }];
    def.balls.forEach((ball, i) => {
      pieces.push({ kind: "big", cell: ball.big, i });
      pieces.push({ kind: "small", cell: view[i], i });
    });
    pieces.sort((p, q) => (p.cell[0] + p.cell[1]) - (q.cell[0] + q.cell[1]));
    pieces.forEach((piece) => {
      const { x, y } = screen(...piece.cell);
      const group = svg("g", { class: "sf-piece" }, top);
      svg("ellipse", { class: "sf-shadow", cx: x, cy: y + 1, rx: 8, ry: 4 }, group);
      if (piece.kind === "player") {
        svg("circle", { class: "sf-player", cx: x, cy: y - 8, r: 6.5 }, group);
        return;
      }
      const ball = def.balls[piece.i];
      const big = piece.kind === "big";
      const struck = big && hit && hit.hit === piece.i;
      svg("circle", { class: "bl-ball" + (big ? " big" : "") + (struck ? " struck" : ""), cx: x, cy: y - (big ? 9 : 6), r: big ? 7.5 : 4.5, style: `fill:${ball.hex}` }, group);
      svg("title", {}, group).textContent = `${big ? "Grosse" : "Petite"} boule ${ball.color}`;
    });

    if (state.anchor) {
      const { x, y } = screen(...state.anchor);
      svg("circle", { class: "sf-anchor-ring", cx: x, cy: y, r: 26 }, top);
    }

    label.textContent = state.step ? `Coup ${state.step} / ${state.plan.path.length}` : "Départ";
    prev.disabled = state.step === 0;
    next.disabled = !state.plan || state.step >= state.plan.path.length;
    planNode.querySelectorAll("li[data-step]").forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle("is-current", n === state.step);
      item.classList.toggle("is-done", n < state.step);
    });
  }

  function showPlan(result) {
    const game = BallSolver.makeGame(def);
    state.plan = result;
    let cells = def.balls.map((b) => b.small);
    let locked = cells.map((c, i) => game.glyphOf.get(key(...c)) === i);
    state.frames = [cells];
    result.path.forEach((move) => {
      const r = BallSolver.strike(game, cells, locked, move.dir, move.hit);
      cells = r.cells;
      locked = r.locked;
      state.frames.push(cells);
    });
    planNode.textContent = "";
    let turn = 0;
    let dir = null;
    result.path.forEach((move, index) => {
      const d = key(...move.dir);
      if (d !== dir) {
        turn += 1;
        dir = d;
        const head = document.createElement("li");
        head.className = "sf-turn";
        head.textContent = `Tour ${turn} : glyphe blanc ${ARROWS[d]}`;
        planNode.appendChild(head);
      }
      const item = document.createElement("li");
      item.dataset.step = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      const ball = def.balls[move.hit];
      button.innerHTML = `<i class="bl-dot" style="background:${ball.hex}"></i>`;
      button.append(`Frappe la grosse boule ${ball.color}`);
      button.addEventListener("click", () => {
        state.step = index + 1;
        draw();
      });
      item.appendChild(button);
      planNode.appendChild(item);
    });
    planCard.hidden = false;
    message.textContent = `${result.path.length} coups en ${turn} tours.`;
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

  // Palette: une couleur, et ce qu'on place (petite boule, glyphe de cette couleur)
  const toolbar = document.getElementById("bl-tools");
  function renderTools() {
    toolbar.textContent = "";
    def.balls.forEach((ball, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sf-tool";
      button.innerHTML = `<i aria-hidden="true" style="background:${ball.hex};border-radius:50%"></i>`;
      button.append(ball.color);
      button.setAttribute("aria-pressed", String(i === state.color));
      button.addEventListener("click", () => {
        state.color = i;
        renderTools();
      });
      toolbar.appendChild(button);
    });
    [["small", "Petite boule"], ["cross", "Glyphe"], ["big", "Grosse boule"]].forEach(([mode, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sf-tool bl-mode";
      button.textContent = text;
      button.setAttribute("aria-pressed", String(mode === state.mode));
      button.addEventListener("click", () => {
        state.mode = mode;
        renderTools();
      });
      toolbar.appendChild(button);
    });
  }

  function edit(a, b, wall) {
    if (wall) {
      const row = [...def.map.rows[b - def.map.bmin]];
      const i = a - def.map.amin;
      row[i] = row[i] === "#" ? "." : "#";
      def.map.rows[b - def.map.bmin] = row.join("");
    } else {
      def.balls[state.color][state.mode] = [a, b];
    }
    save();
    clearPlan();
    draw();
  }
  board.addEventListener("click", (event) => {
    const cell = event.target.closest(".bl-cell, .bl-hole");
    if (cell) edit(Number(cell.dataset.a), Number(cell.dataset.b), false);
  });
  board.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".bl-cell");
    if (!cell) return;
    event.preventDefault();
    edit(Number(cell.dataset.a), Number(cell.dataset.b), true);
  });

  // Lecture d'une capture: ta case et 2 glyphes blancs à côté de toi, puis le trou de chaque glyphe de couleur
  // (leur position exacte est lue sur la capture); voir assets/js/lib/capture-grid.js
  CaptureGrid.listen({
    button: document.getElementById("bl-import"),
    drop: board,
    onImage: (image) => {
      const [pa, pb] = def.player;
      CaptureGrid.open({
        image,
        anchors: [
          { cell: [pa, pb], label: "Clique sur ta case (ton personnage)." },
          { cell: [pa + 1, pb], label: "Clique sur le glyphe blanc en bas à droite de toi (↘)." },
          { cell: [pa, pb - 1], label: "Clique sur le glyphe blanc en haut à droite de toi (↗)." },
        ],
        extra: def.balls.map((ball) => ({ label: `Clique sur le trou au centre du glyphe ${ball.color}.` })),
        highlight: (cell) => {
          state.anchor = cell || null;
          draw();
        },
        preview: () => board.cloneNode(true),
        done: (first, cells, refit, locate) => {
          const { cells: holes, sample } = locate();
          def.balls.forEach((ball, i) => { ball.cross = holes[i]; });
          const read = BallCapture.read(sample, def, 5);
          let found = 0;
          read.forEach((r, i) => {
            if (!r) return;
            def.balls[i].big = r.big;
            def.balls[i].small = r.small;
            found += 1;
          });
          save();
          clearPlan();
          draw();
          message.textContent = `Glyphes placés, ${found} couleur${found > 1 ? "s" : ""} de boules lue${found > 1 ? "s" : ""} sur ${def.balls.length}. Vérifie la carte (et les murs) avant de calculer.`;
        },
      });
    },
  });

  let worker = null;
  solveButton.addEventListener("click", () => {
    if (worker) worker.terminate();
    clearPlan();
    message.textContent = "Calcul en cours (quelques secondes)…";
    solveButton.disabled = true;
    // Worker à partir du solveur déjà chargé (pas de fichier en plus)
    const source = `importScripts(${JSON.stringify(new URL("assets/js/boules/solver.js", location.href).href)});
      onmessage = (e) => postMessage(BallSolver.solve(BallSolver.makeGame(e.data), e.data));`;
    worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    worker.onmessage = (event) => {
      solveButton.disabled = false;
      worker.terminate();
      worker = null;
      if (event.data) showPlan(event.data);
      else message.textContent = "Aucune suite de coups trouvée : vérifie la carte (murs, glyphes, boules).";
    };
    worker.postMessage(def);
  });
  document.getElementById("bl-reset").addEventListener("click", () => {
    def = structuredClone(example);
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

  renderTools();
  draw();
})();
