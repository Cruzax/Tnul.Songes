// Page « Les petites machines »: carte du combat « Ce qui est », placement des machines, plan de frappes
// calculé par assets/js/machines/solver.js et rejoué frappe par frappe.
(async function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STEP_X = 22;
  const STEP_Y = 11;
  const SIDE = 6;
  const STORAGE_KEY = "tnul-machines";
  const ARROWS = { "1,0": "↘", "-1,0": "↖", "0,1": "↙", "0,-1": "↗" };
  const TOOLS = [
    { id: "m", label: "Petite machine" },
    { id: "p", label: "Ma position" },
    { id: "x", label: "Effacer" },
  ];

  const board = document.getElementById("mc-board");
  const label = document.getElementById("mc-step-label");
  const prev = document.getElementById("mc-prev");
  const next = document.getElementById("mc-next");
  const message = document.getElementById("mc-message");
  const planCard = document.getElementById("mc-plan-card");
  const planNode = document.getElementById("mc-plan");

  let guide;
  try {
    guide = await fetch("data/machines.json").then((response) => response.json());
  } catch (error) {
    message.textContent = "Impossible de charger la carte.";
    console.error("Erreur de chargement:", error.message);
    return;
  }

  const fresh = () => ({ player: guide.player.slice(), machines: guide.machines.map((m) => ({ ...m, cell: m.cell.slice() })) });
  let layout = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.machines) && Array.isArray(saved.player)) layout = saved;
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

  const game = MachineSolver.makeGame(guide);
  const state = { tool: "m", plan: null, frames: [], step: 0 };
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
  const glyphKeys = new Set(guide.glyphs.map((g) => key(...g)));

  const cells = [];
  guide.map.rows.forEach((row, line) => {
    [...row].forEach((ch, column) => {
      if (ch !== " ") cells.push({ a: guide.map.amin + column, b: guide.map.bmin + line, hole: ch === "o" });
    });
  });
  cells.sort((p, q) => (p.a + p.b) - (q.a + q.b) || (p.a - p.b) - (q.a - q.b));
  const known = new Set(cells.map((c) => key(c.a, c.b)));

  function draw() {
    const view = state.frames[state.step] || layout;
    const hit = state.step ? state.plan.plan[state.step - 1] : null;
    board.textContent = "";
    const xs = cells.map((c) => screen(c.a, c.b).x);
    const ys = cells.map((c) => screen(c.a, c.b).y);
    board.setAttribute("viewBox", [Math.min(...xs) - STEP_X - 4, Math.min(...ys) - STEP_Y - 26, Math.max(...xs) - Math.min(...xs) + STEP_X * 2 + 8, Math.max(...ys) - Math.min(...ys) + STEP_Y * 2 + SIDE + 30].join(" "));
    const slabs = svg("g", {}, board);
    const floor = svg("g", {}, board);
    const marks = svg("g", {}, board);
    const top = svg("g", {}, board);
    cells.forEach(({ a, b, hole }) => {
      const { x, y } = screen(a, b);
      if (!known.has(key(a, b + 1))) svg("polygon", { class: "sf-side-l", points: points([[x - STEP_X, y], [x, y + STEP_Y], [x, y + STEP_Y + SIDE], [x - STEP_X, y + SIDE]]) }, slabs);
      if (!known.has(key(a + 1, b))) svg("polygon", { class: "sf-side-r", points: points([[x, y + STEP_Y], [x + STEP_X, y], [x + STEP_X, y + SIDE], [x, y + STEP_Y + SIDE]]) }, slabs);
      const classes = hole ? "mc-hole" : `mc-cell${(a + b) % 2 ? " alt" : ""}${glyphKeys.has(key(a, b)) ? " glyph" : ""}`;
      const cell = svg("polygon", { class: classes, points: diamond(x, y) }, floor);
      cell.dataset.a = a;
      cell.dataset.b = b;
    });

    // Frappe affichée: case où se placer, trajet de la machine
    if (hit) {
      const p = screen(...hit.player);
      svg("polygon", { class: "mc-spot", points: diamond(p.x, p.y) }, marks);
      const from = screen(...hit.from);
      const to = screen(...hit.to);
      svg("line", { class: "mc-trail", x1: from.x, y1: from.y, x2: to.x, y2: to.y }, marks);
      svg("line", { class: "mc-aim", x1: p.x, y1: p.y, x2: from.x, y2: from.y }, marks);
    }

    const pieces = view.machines.map((m) => ({ ...m, kind: "machine", active: hit && hit.id === m.id }));
    pieces.push({ kind: "big", cell: guide.center });
    pieces.push({ kind: "player", cell: view.player });
    pieces.sort((p, q) => (p.cell[0] + p.cell[1]) - (q.cell[0] + q.cell[1]));
    pieces.forEach((piece) => {
      const { x, y } = screen(...piece.cell);
      const group = svg("g", { class: "sf-piece" }, top);
      svg("ellipse", { class: "sf-shadow", cx: x, cy: y + 1, rx: piece.kind === "big" ? 13 : 8, ry: piece.kind === "big" ? 6 : 4 }, group);
      if (piece.kind === "player") {
        svg("circle", { class: "sf-player", cx: x, cy: y - 8, r: 6.5 }, group);
        svg("title", {}, group).textContent = "Toi";
        return;
      }
      if (piece.kind === "big") {
        svg("rect", { class: "mc-big", x: x - 10, y: y - 22, width: 20, height: 20, rx: 4 }, group);
        svg("circle", { class: "mc-wheel", cx: x, cy: y - 12, r: 6 }, group);
        svg("title", {}, group).textContent = "Grosse machine";
        return;
      }
      const onGlyph = glyphKeys.has(key(...piece.cell));
      svg("rect", { class: `mc-small${piece.active ? " active" : ""}${onGlyph ? " done" : ""}`, x: x - 6.5, y: y - 15, width: 13, height: 13, rx: 3 }, group);
      svg("text", { class: "mc-id", x, y: y - 6, "text-anchor": "middle" }, group).textContent = piece.id;
      svg("title", {}, group).textContent = `Machine ${piece.id}`;
    });

    label.textContent = state.step ? `Frappe ${state.step} / ${state.plan.plan.length}` : "Départ";
    prev.disabled = state.step === 0;
    next.disabled = !state.plan || state.step >= state.plan.plan.length;
    planNode.querySelectorAll("li[data-step]").forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle("is-current", n === state.step);
      item.classList.toggle("is-done", n < state.step);
    });
  }

  function describe(hit) {
    const d = [Math.sign(hit.from[0] - hit.player[0]), Math.sign(hit.from[1] - hit.player[1])];
    const dist = Math.abs(hit.from[0] - hit.player[0]) + Math.abs(hit.from[1] - hit.player[1]);
    const glyph = glyphKeys.has(key(...hit.to)) ? " : elle arrive sur son glyphe" : "";
    return `Machine ${hit.id} : place-toi sur la case bleue, frappe-la ${ARROWS[key(...d)]} à ${dist} cases${glyph}`;
  }

  function showPlan(result) {
    state.plan = result;
    state.frames = [layout];
    let machines = layout.machines;
    result.plan.forEach((hit) => {
      machines = machines.map((m) => (m.id === hit.id ? { ...m, cell: hit.to } : m));
      state.frames.push({ player: hit.player, machines });
    });
    planNode.textContent = "";
    result.plan.forEach((hit, index) => {
      const item = document.createElement("li");
      item.dataset.step = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = describe(hit);
      button.addEventListener("click", () => {
        state.step = index + 1;
        draw();
      });
      item.appendChild(button);
      planNode.appendChild(item);
    });
    planCard.hidden = false;
    message.textContent = `${result.plan.length} frappes pour placer les 4 machines.`;
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

  function place(a, b, tool) {
    if (!game.floor.has(key(a, b))) return;
    const index = layout.machines.findIndex((m) => m.cell[0] === a && m.cell[1] === b);
    const isPlayer = layout.player[0] === a && layout.player[1] === b;
    if (tool === "p") {
      if (index >= 0) return;
      layout.player = [a, b];
    } else if (tool === "x") {
      if (index >= 0) layout.machines.splice(index, 1);
    } else if (index < 0 && !isPlayer) {
      layout.machines.push({ id: Math.max(1, ...layout.machines.map((m) => m.id)) + 1, cell: [a, b] });
    }
    save();
    clearPlan();
    draw();
  }
  board.addEventListener("click", (event) => {
    const cell = event.target.closest(".mc-cell");
    if (cell) place(Number(cell.dataset.a), Number(cell.dataset.b), state.tool);
  });
  board.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".mc-cell");
    if (!cell) return;
    event.preventDefault();
    place(Number(cell.dataset.a), Number(cell.dataset.b), "x");
  });

  const toolbar = document.getElementById("mc-tools");
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

  document.getElementById("mc-solve").addEventListener("click", () => {
    clearPlan();
    if (layout.machines.length > game.glyphs.length) {
      message.textContent = "Il y a plus de machines que de glyphes : vérifie la carte.";
      return;
    }
    message.textContent = "Calcul en cours…";
    // Laisse le message s'afficher avant le calcul (moins d'une seconde)
    setTimeout(() => {
      const range = Math.max(2, Math.min(12, Number(document.getElementById("mc-range").value) || 6));
      const result = MachineSolver.solve(game, { ...guide, player: layout.player, machines: layout.machines }, { range });
      if (result) showPlan(result);
      else message.textContent = "Aucun plan trouvé avec cette portée : essaie une portée plus grande, ou vérifie la carte.";
    }, 30);
  });
  document.getElementById("mc-reset").addEventListener("click", () => {
    layout = fresh();
    save();
    clearPlan();
    draw();
  });
  prev.addEventListener("click", () => { if (state.step > 0) { state.step--; draw(); } });
  next.addEventListener("click", () => { if (state.plan && state.step < state.plan.plan.length) { state.step++; draw(); } });
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;
    if (event.key === "ArrowLeft") prev.click();
    if (event.key === "ArrowRight") next.click();
  });

  draw();
})();
