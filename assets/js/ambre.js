// Aide au combat tactique de « Le serment de l'ambre » (Memory des Malters): on note les Malters trouvés, la page propose les paires.
(async function () {
  const STEP_X = 27.5;
  const STEP_Y = 13.75;
  const SIDE = 12;
  const ROCK_HEIGHT = 10;
  const STORAGE_KEY = "tnul-ambre-v1";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const TYPES = {
    epik: { label: "Malépik", color: "#3b9cff" },
    bois: { label: "Malbois", color: "#a35cd6" },
    trio: { label: "Maltrio", color: "#e8394a" },
    zerb: { label: "Malzerb", color: "#34c759" },
  };
  const TOOLS = [
    { id: "d", label: "Malter détecté", color: "#f2f2f2" },
    ...Object.entries(TYPES).map(([id, type]) => ({ id, label: type.label, color: type.color })),
    { id: "done", label: "Paire éliminée", color: "#2b2f3a" },
    { id: "vide", label: "Case vide", color: "#6d7589" },
  ];
  // Le Malter démoniaque change d'îlot tous les 2 tours (aux tours 3, 5, 7...), dans le sens contre-horaire
  const DEMON_ORDER = ["E", "N", "O", "S"];
  const MAX_TURN = 31;
  const PER_ISLAND = 8;

  const board = document.getElementById("am-board");
  const toolsNode = document.getElementById("am-tools");
  const pairsNode = document.getElementById("am-pairs");
  const progressNode = document.getElementById("am-progress");
  const islandsNode = document.getElementById("am-islands");
  const demonNode = document.getElementById("am-demon");
  const turnInput = document.getElementById("am-turn");

  let map;
  try {
    map = await fetch("data/ambre.json").then((response) => response.json());
  } catch (error) {
    board.replaceWith(Object.assign(document.createElement("p"), { textContent: "Impossible de charger la carte." }));
    console.error("Erreur de chargement:", error.message);
    return;
  }

  const keyOf = (i, j) => `${i},${j}`;
  const cells = map.cells.map(([i, j, rock, island]) => ({
    i, j, rock: Boolean(rock), island, key: keyOf(i, j), x: i * STEP_X, y: j * STEP_Y,
  }));
  const byKey = new Map(cells.map((cell) => [cell.key, cell]));
  const islandName = (id) => map.island[id];

  const state = { marks: {}, tool: "d", turn: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved.marks === "object") {
      state.marks = saved.marks;
      state.turn = Math.min(MAX_TURN, Math.max(1, Number(saved.turn) || 1));
    }
  } catch (error) {
    // stockage indisponible: on repart de zéro
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ marks: state.marks, turn: state.turn }));
    } catch (error) {
      // sans importance
    }
  }

  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) {
      parent.appendChild(node);
    }
    return node;
  };
  const points = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");

  // ---- Dessin de la carte ----
  const nodes = new Map();

  function drawBoard() {
    const minI = Math.min(...cells.map((c) => c.i));
    const maxI = Math.max(...cells.map((c) => c.i));
    const minJ = Math.min(...cells.map((c) => c.j));
    const maxJ = Math.max(...cells.map((c) => c.j));
    board.setAttribute("viewBox", [
      minI * STEP_X - STEP_X - 4,
      minJ * STEP_Y - STEP_Y - ROCK_HEIGHT - 4,
      (maxI - minI) * STEP_X + STEP_X * 2 + 8,
      (maxJ - minJ) * STEP_Y + STEP_Y * 2 + ROCK_HEIGHT + SIDE + 8,
    ].join(" "));

    const drawn = [...cells].sort((p, q) => p.y - q.y || p.x - q.x);
    // Même rendu que la page des salles: sols à plat, tranche seulement sur les bords visibles, obstacles pleins par-dessus
    const slabLayer = svg("g", {}, board);
    const cellLayer = svg("g", {}, board);
    const rockLayer = svg("g", {}, board);
    const badgeLayer = svg("g", {}, board);
    drawn.forEach((cell) => {
      const { x, y } = cell;
      if (!byKey.has(keyOf(cell.i - 1, cell.j + 1))) {
        svg("polygon", { class: "am-side-l", points: points([[x - STEP_X, y], [x, y + STEP_Y], [x, y + STEP_Y + SIDE], [x - STEP_X, y + SIDE]]) }, slabLayer);
      }
      if (!byKey.has(keyOf(cell.i + 1, cell.j + 1))) {
        svg("polygon", { class: "am-side-r", points: points([[x, y + STEP_Y], [x + STEP_X, y], [x + STEP_X, y + SIDE], [x, y + STEP_Y + SIDE]]) }, slabLayer);
      }
    });
    drawn.forEach((cell) => {
      const { x, y } = cell;
      const top = svg("polygon", {
        class: "am-cell" + (cell.i % 2 ? " alt" : ""),
        points: points([[x, y - STEP_Y], [x + STEP_X, y], [x, y + STEP_Y], [x - STEP_X, y]]),
      }, cellLayer);
      top.dataset.key = cell.key;
      if (cell.rock) {
        return;
      }
      if (cell.island === "C") {
        top.classList.add("is-home");
        return;
      }
      const badge = svg("text", { class: "am-badge", x, y: y + 4, "text-anchor": "middle" }, badgeLayer);
      nodes.set(cell.key, { top, badge });
    });
    // Cases jamais en ligne de vue (carte DPLN): la Prescience n'y voit rien, il faut l'Intuition ou la Perception
    // Sous les rochers, pour que ceux-ci passent devant
    const sightLayer = svg("g", { class: "am-nosight-layer" });
    board.insertBefore(sightLayer, rockLayer);
    (map.noSight || []).forEach(([i, j]) => {
      const cell = byKey.get(keyOf(i, j));
      if (!cell) return;
      const inset = 0.9;
      svg("polygon", {
        class: "am-nosight",
        points: points([[cell.x, cell.y - STEP_Y * inset], [cell.x + STEP_X * inset, cell.y], [cell.x, cell.y + STEP_Y * inset], [cell.x - STEP_X * inset, cell.y]]),
      }, sightLayer);
    });
    drawn.filter((cell) => cell.rock).forEach((cell) => {
      const { x, y } = cell;
      const up = y - ROCK_HEIGHT;
      const group = svg("g", {}, rockLayer);
      svg("polygon", { class: "am-rock-l", points: points([[x - STEP_X, up], [x, up + STEP_Y], [x, y + STEP_Y], [x - STEP_X, y]]) }, group);
      svg("polygon", { class: "am-rock-r", points: points([[x + STEP_X, up], [x, up + STEP_Y], [x, y + STEP_Y], [x + STEP_X, y]]) }, group);
      svg("polygon", { class: "am-rock-top", points: points([[x - STEP_X, up], [x, up - STEP_Y], [x + STEP_X, up], [x, up + STEP_Y]]) }, group);
    });
  }

  const sightToggle = document.getElementById("am-nosight");
  if (sightToggle) {
    sightToggle.addEventListener("change", () => board.classList.toggle("hide-nosight", !sightToggle.checked));
  }

  // ---- Barre d'outils ----
  TOOLS.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "am-tool";
    button.dataset.tool = tool.id;
    const swatch = document.createElement("span");
    swatch.className = "am-swatch";
    swatch.style.background = tool.color;
    button.append(swatch, tool.label);
    button.addEventListener("click", () => {
      state.tool = tool.id;
      renderTools();
    });
    toolsNode.appendChild(button);
  });
  function renderTools() {
    toolsNode.querySelectorAll(".am-tool").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tool === state.tool));
    });
  }

  // ---- Interactions ----
  function mark(key, tool) {
    if (!byKey.has(key) || byKey.get(key).rock || byKey.get(key).island === "C") {
      return;
    }
    if (!tool || state.marks[key] === tool) {
      delete state.marks[key];
    } else {
      state.marks[key] = tool;
    }
    save();
    render();
  }
  board.addEventListener("click", (event) => {
    const key = event.target.dataset && event.target.dataset.key;
    if (key) {
      mark(key, state.tool);
    }
  });
  board.addEventListener("contextmenu", (event) => {
    const key = event.target.dataset && event.target.dataset.key;
    if (key) {
      event.preventDefault();
      mark(key, null);
    }
  });

  function setTurn(value) {
    state.turn = Math.min(MAX_TURN, Math.max(1, Math.round(Number(value)) || 1));
    save();
    render();
  }
  turnInput.addEventListener("change", () => setTurn(turnInput.value));
  document.getElementById("am-turn-minus").addEventListener("click", () => setTurn(state.turn - 1));
  document.getElementById("am-turn-plus").addEventListener("click", () => setTurn(state.turn + 1));
  document.getElementById("am-reset").addEventListener("click", () => {
    if (Object.keys(state.marks).length && !window.confirm("Tout effacer ?")) {
      return;
    }
    state.marks = {};
    state.turn = 1;
    save();
    render();
  });

  // ---- Calculs ----
  function computePairs() {
    const pairs = [];
    const waiting = [];
    Object.keys(TYPES).forEach((type) => {
      const keys = Object.keys(state.marks)
        .filter((key) => state.marks[key] === type)
        .sort((a, b) => byKey.get(a).island.localeCompare(byKey.get(b).island) || byKey.get(a).y - byKey.get(b).y);
      for (let n = 0; n + 1 < keys.length; n += 2) {
        pairs.push({ type, a: keys[n], b: keys[n + 1] });
      }
      if (keys.length % 2) {
        waiting.push({ type, key: keys[keys.length - 1] });
      }
    });
    return { pairs, waiting };
  }

  function demonIsland(turn) {
    return DEMON_ORDER[Math.floor((turn - 1) / 2) % DEMON_ORDER.length];
  }

  // ---- Affichage ----
  function render() {
    const { pairs, waiting } = computePairs();
    const badgeOf = new Map();
    pairs.forEach((pair, index) => {
      badgeOf.set(pair.a, index + 1);
      badgeOf.set(pair.b, index + 1);
    });
    const demon = demonIsland(state.turn);

    cells.forEach((cell) => {
      const node = nodes.get(cell.key);
      if (!node) {
        return;
      }
      const mark = state.marks[cell.key];
      const tool = mark && TOOLS.find((t) => t.id === mark);
      node.top.style.fill = tool ? tool.color : "";
      node.top.classList.toggle("is-done", mark === "done");
      node.top.classList.toggle("is-empty", mark === "vide");
      node.badge.textContent = mark === "vide" ? "×" : badgeOf.has(cell.key) ? String(badgeOf.get(cell.key)) : "";
      node.badge.classList.toggle("on-light", mark === "d");
    });

    turnInput.value = String(state.turn);
    demonNode.textContent = `Malter démoniaque: îlot ${islandName(demon)}` +
      (state.turn < MAX_TURN ? ` (change au tour ${state.turn % 2 ? state.turn + 2 : state.turn + 1})` : "") +
      (state.turn >= 28 ? " · plus que quelques tours avant l'OS !" : "");

    pairsNode.innerHTML = "";
    pairs.forEach((pair, index) => {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "am-swatch";
      dot.style.background = TYPES[pair.type].color;
      item.append(dot, `${index + 1}. ${TYPES[pair.type].label}: ${islandName(byKey.get(pair.a).island)} + ${islandName(byKey.get(pair.b).island)}`);
      pairsNode.appendChild(item);
    });
    waiting.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "is-waiting";
      const dot = document.createElement("span");
      dot.className = "am-swatch";
      dot.style.background = TYPES[entry.type].color;
      item.append(dot, `${TYPES[entry.type].label} (${islandName(byKey.get(entry.key).island)}): il manque son double`);
      pairsNode.appendChild(item);
    });
    if (!pairs.length && !waiting.length) {
      const item = document.createElement("li");
      item.className = "is-waiting";
      item.textContent = "Marque des Malters avec leur type: les paires apparaissent ici.";
      pairsNode.appendChild(item);
    }

    const done = Object.values(state.marks).filter((value) => value === "done").length / 2;
    progressNode.textContent = `${Math.floor(done)} paire${done >= 2 ? "s" : ""} éliminée${done >= 2 ? "s" : ""} sur 16 · tour ${state.turn}/${MAX_TURN}`;

    islandsNode.innerHTML = "";
    Object.keys(map.island).filter((id) => id !== "C").forEach((id) => {
      const found = Object.keys(state.marks).filter((key) => byKey.get(key).island === id && state.marks[key] !== "vide").length;
      const item = document.createElement("li");
      item.textContent = `${islandName(id)}: ${found}/${PER_ISLAND} notés`;
      islandsNode.appendChild(item);
    });
  }

  drawBoard();
  renderTools();
  render();
})();
