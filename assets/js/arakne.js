// Page « L'arakne de Leng »: les 2 combats tactiques en petite arakne, rejoués tour par tour.
// Les monstres partent des mêmes cases et jouent pareil à chaque fois: les méthodes (data/arakne.json, d'après
// Dofus pour les Noobs) donnent la case d'arrivée de chaque tour; le chemin entre deux cases est recalculé ici.
(async function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STEP_X = 27.5;
  const STEP_Y = 13.75;
  const ROCK_HEIGHT = 10;
  const SIDE = 7;
  // Une couleur par tour, comme les schémas du guide
  const COLORS = ["#f2c94c", "#6fcf97", "#5b8def", "#b072e8", "#eb5757", "#56ccf2", "#f2994a", "#27ae60", "#e86fb0", "#c7d36f", "#9aa6c2", "#2dd4bf"];
  const ARROWS = { "1,0": "↘", "-1,0": "↖", "0,1": "↙", "0,-1": "↗" };

  const board = document.getElementById("ak-board");
  const tabs = document.getElementById("ak-tabs");
  const turnsNode = document.getElementById("ak-turns");
  const label = document.getElementById("ak-step-label");
  const prev = document.getElementById("ak-prev");
  const next = document.getElementById("ak-next");

  let data;
  try {
    data = await fetch("data/arakne.json").then((response) => response.json());
  } catch (error) {
    label.textContent = "Impossible de charger les combats.";
    console.error("Erreur de chargement:", error.message);
    return;
  }

  const keyOf = (a, b) => `${a},${b}`;
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) parent.appendChild(node);
    return node;
  };
  const points = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");
  const screen = (a, b) => ({ x: (a - b) * STEP_X, y: (a + b) * STEP_Y });

  // Carte: une ligne par valeur de b, un caractère par valeur de a (voir « legend » dans le JSON)
  function readMap(map) {
    const cells = new Map();
    let start = null;
    map.rows.forEach((row, line) => {
      [...row].forEach((kind, column) => {
        if (kind === " ") return;
        const a = map.amin + column;
        const b = map.bmin + line;
        cells.set(keyOf(a, b), { a, b, kind });
        if (kind === "S") start = [a, b];
      });
    });
    // Un « bloc » collé au vide est un mur ou un rebord du décor: on ne le dessine pas, seuls les vrais obstacles restent
    const edge = [...cells.values()].filter(({ a, b, kind }) => kind === "X"
      && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([da, db]) => !cells.has(keyOf(a + da, b + db))));
    edge.forEach(({ a, b }) => cells.delete(keyOf(a, b)));
    return { cells, start };
  }

  const walkable = (cell) => cell && cell.kind !== "X" && cell.kind !== "O";

  // Plus court chemin en 4 directions (les PM d'une arakne), départ et arrivée compris
  function route(cells, from, to) {
    const start = keyOf(...from);
    const goal = keyOf(...to);
    const came = new Map([[start, null]]);
    const queue = [from];
    while (queue.length) {
      const [a, b] = queue.shift();
      if (keyOf(a, b) === goal) break;
      [[1, 0], [0, -1], [-1, 0], [0, 1]].forEach(([da, db]) => {
        const key = keyOf(a + da, b + db);
        if (!came.has(key) && walkable(cells.get(key))) {
          came.set(key, keyOf(a, b));
          queue.push([a + da, b + db]);
        }
      });
    }
    if (!came.has(goal)) return [from, to];
    const path = [];
    for (let key = goal; key; key = came.get(key)) path.unshift(key.split(",").map(Number));
    return path;
  }

  // Les déplacements d'un tour en flèches regroupées: « ↗ 2 · ↖ 1 »
  function arrows(path) {
    const groups = [];
    for (let i = 1; i < path.length; i++) {
      const arrow = ARROWS[keyOf(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])];
      const last = groups[groups.length - 1];
      if (last && last.arrow === arrow) last.count++;
      else groups.push({ arrow, count: 1 });
    }
    return groups.map((group) => `${group.arrow} ${group.count}`).join(" · ");
  }

  // Combat + méthode affichés, et tour en cours (0 = départ)
  const views = data.fights.flatMap((fight) => fight.methods.map((method) => ({ fight, method })));
  const state = { view: 0, step: 0 };
  const cache = new Map();

  function prepare(view) {
    if (cache.has(view)) return cache.get(view);
    const { fight, method } = view;
    const { cells, start } = readMap(fight.map);
    let here = start;
    const turns = method.turns.map((turn, index) => {
      const path = route(cells, here, turn.to);
      here = turn.to;
      return { ...turn, path, color: COLORS[index % COLORS.length], moves: path.length - 1 };
    });
    const prepared = { cells, start, turns };
    cache.set(view, prepared);
    return prepared;
  }

  function drawCell(layer, a, b, className) {
    const { x, y } = screen(a, b);
    return svg("polygon", { class: className, points: points([[x, y - STEP_Y], [x + STEP_X, y], [x, y + STEP_Y], [x - STEP_X, y]]) }, layer);
  }

  function draw() {
    const view = views[state.view];
    const { fight } = view;
    const { cells, start, turns } = prepare(view);
    board.textContent = "";
    const all = [...cells.values()];
    const xs = all.map((c) => screen(c.a, c.b).x);
    const ys = all.map((c) => screen(c.a, c.b).y);
    board.setAttribute("viewBox", [Math.min(...xs) - STEP_X - 6, Math.min(...ys) - STEP_Y - ROCK_HEIGHT - 6, Math.max(...xs) - Math.min(...xs) + STEP_X * 2 + 12, Math.max(...ys) - Math.min(...ys) + STEP_Y * 2 + ROCK_HEIGHT + SIDE + 12].join(" "));

    const slabs = svg("g", {}, board);
    const floor = svg("g", {}, board);
    const marks = svg("g", {}, board);
    const blocks = svg("g", {}, board);
    const pieces = svg("g", {}, board);
    const drawn = all.sort((p, q) => (p.a + p.b) - (q.a + q.b) || (p.a - p.b) - (q.a - q.b));

    // Sol à plat (tranche sur les bords visibles), trous en creux, blocs pleins par-dessus
    drawn.forEach((cell) => {
      const { x, y } = screen(cell.a, cell.b);
      if (cell.kind === "O") return;
      if (!walkable(cells.get(keyOf(cell.a, cell.b + 1))) && cell.kind !== "X") {
        svg("polygon", { class: "ak-side-l", points: points([[x - STEP_X, y], [x, y + STEP_Y], [x, y + STEP_Y + SIDE], [x - STEP_X, y + SIDE]]) }, slabs);
      }
      if (!walkable(cells.get(keyOf(cell.a + 1, cell.b))) && cell.kind !== "X") {
        svg("polygon", { class: "ak-side-r", points: points([[x, y + STEP_Y], [x + STEP_X, y], [x + STEP_X, y + SIDE], [x, y + STEP_Y + SIDE]]) }, slabs);
      }
    });
    drawn.forEach((cell) => {
      const { a, b, kind } = cell;
      const { x, y } = screen(a, b);
      if (kind === "O") {
        drawCell(floor, a, b, "ak-hole");
        return;
      }
      const classes = { G: "ak-cell goal", B: "ak-cell brown", S: "ak-cell start" };
      drawCell(floor, a, b, (classes[kind] || "ak-cell") + ((a + b) % 2 ? " alt" : ""));
      if (kind === "X") {
        const top = y - ROCK_HEIGHT;
        svg("polygon", { class: "ak-rock-l", points: points([[x - STEP_X, top], [x, top + STEP_Y], [x, y + STEP_Y], [x - STEP_X, y]]) }, blocks);
        svg("polygon", { class: "ak-rock-r", points: points([[x, top + STEP_Y], [x + STEP_X, top], [x + STEP_X, y], [x, y + STEP_Y]]) }, blocks);
        svg("polygon", { class: "ak-rock-top", points: points([[x, top - STEP_Y], [x + STEP_X, top], [x, top + STEP_Y], [x - STEP_X, top]]) }, blocks);
      }
    });

    // Chemins: tours passés en pâle, tour en cours en couleur vive, tours suivants cachés
    turns.forEach((turn, index) => {
      const number = index + 1;
      if (number > state.step) return;
      const current = number === state.step;
      const line = turn.path.map(([a, b]) => { const p = screen(a, b); return [p.x, p.y]; });
      turn.path.slice(1).forEach(([a, b]) => drawCell(marks, a, b, "ak-trail").setAttribute("style", `fill:${turn.color};opacity:${current ? 0.45 : 0.16}`));
      if (line.length > 1) {
        svg("polyline", { class: "ak-path", points: points(line), stroke: turn.color, opacity: current ? 1 : 0.35 }, marks);
      }
      const end = screen(...turn.to);
      if (current) {
        drawCell(marks, ...turn.to, "ak-end").setAttribute("style", `fill:${turn.color}`);
        if (turn.course) {
          const tag = svg("g", { class: "ak-tag", transform: `translate(${end.x} ${end.y - 30})` }, pieces);
          svg("rect", { x: -16, y: -8, width: 32, height: 14, rx: 3 }, tag);
          svg("text", { x: 0, y: 3, "text-anchor": "middle" }, tag).textContent = "+2 PM";
        }
      }
      if (turn.egg) {
        const egg = screen(...turn.egg);
        svg("ellipse", { class: "ak-egg" + (current ? " now" : ""), cx: egg.x, cy: egg.y - 5, rx: 5, ry: 7 }, pieces);
      }
      if (turn.bite && current) {
        const bite = screen(...turn.bite);
        svg("path", { class: "ak-bite", d: `M${bite.x - 6} ${bite.y - 6} L${bite.x + 6} ${bite.y + 6} M${bite.x + 6} ${bite.y - 6} L${bite.x - 6} ${bite.y + 6}` }, pieces);
      }
    });

    // Monstres à leur place de départ (seulement avant le premier tour: ensuite ils ont bougé)
    if (state.step === 0) {
      fight.monsters.forEach((monster) => {
        const { x, y } = screen(...monster.cell);
        const group = svg("g", { class: "ak-monster" }, pieces);
        svg("ellipse", { cx: x, cy: y + 2, rx: 10, ry: 5, class: "ak-shadow" }, group);
        svg("circle", { cx: x, cy: y - 8, r: 7 }, group);
        svg("title", {}, group).textContent = monster.name;
      });
    }

    // Arakne: au départ ou à la fin du tour affiché
    const at = state.step ? turns[state.step - 1].to : start;
    const me = screen(...at);
    const player = svg("g", { class: "ak-player" }, pieces);
    svg("ellipse", { cx: me.x, cy: me.y + 2, rx: 10, ry: 5, class: "ak-shadow" }, player);
    svg("circle", { cx: me.x, cy: me.y - 9, r: 8 }, player);
    svg("title", {}, player).textContent = "Toi (petite arakne)";

    // Textes
    label.textContent = state.step ? `Tour ${state.step} / ${turns.length}` : "Départ";
    prev.disabled = state.step === 0;
    next.disabled = state.step === turns.length;
    turnsNode.querySelectorAll("li").forEach((item, index) => {
      item.classList.toggle("is-current", index + 1 === state.step);
      item.classList.toggle("is-done", index + 1 < state.step);
    });
  }

  // Panneau de droite: but, risques, règles et la liste des tours (cliquables)
  function fill() {
    const { fight, method } = views[state.view];
    const { turns } = prepare(views[state.view]);
    document.getElementById("ak-fight-title").textContent = `${fight.title} · ${method.name}`;
    document.getElementById("ak-goal").textContent = fight.goal;
    document.getElementById("ak-risk").textContent = method.risk || "";
    const rules = document.getElementById("ak-rules");
    rules.textContent = "";
    (fight.rules || []).forEach((rule) => {
      const item = document.createElement("li");
      item.textContent = rule;
      rules.appendChild(item);
    });
    turnsNode.textContent = "";
    turns.forEach((turn, index) => {
      const item = document.createElement("li");
      item.style.setProperty("--turn", turn.color);
      const button = document.createElement("button");
      button.type = "button";
      const head = document.createElement("span");
      head.className = "ak-turn-head";
      head.textContent = `Tour ${index + 1}`;
      const move = document.createElement("span");
      move.className = "ak-turn-move";
      // Sorts du tour, avec leur icône (assets/images/spells)
      const spells = [[turn.course, "Petite Course", 15520], [turn.egg, "Œuf", 12451], [turn.bite, "Morsure", 15556]];
      move.append(turn.moves ? arrows(turn.path) : "reste sur place");
      spells.filter(([used]) => used).forEach(([, name, icon]) => {
        const spell = document.createElement("span");
        spell.className = "spell-name";
        const img = document.createElement("img");
        img.className = "spell-ic";
        img.src = `assets/images/spells/sort_${icon}.png`;
        img.alt = "";
        spell.append(img, name);
        move.append(" · ", spell);
      });
      button.append(head, move);
      if (turn.note) {
        const note = document.createElement("span");
        note.className = "ak-turn-note";
        note.textContent = turn.note;
        button.appendChild(note);
      }
      button.addEventListener("click", () => {
        state.step = index + 1;
        draw();
      });
      item.appendChild(button);
      turnsNode.appendChild(item);
    });
  }

  views.forEach((view, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "ak-tab";
    tab.setAttribute("role", "tab");
    tab.textContent = view.fight.methods.length > 1 ? `${view.fight.title.split(" :")[0]} · ${view.method.name}` : view.fight.title.split(" :")[0];
    tab.addEventListener("click", () => {
      state.view = index;
      state.step = 0;
      tabs.querySelectorAll(".ak-tab").forEach((other, i) => other.setAttribute("aria-selected", String(i === index)));
      fill();
      draw();
    });
    tab.setAttribute("aria-selected", String(index === 0));
    tabs.appendChild(tab);
  });

  const legend = document.getElementById("ak-legend");
  [["start", "Départ"], ["goal", "Arrivée"], ["brown", "Case marron : invulnérable"], ["egg", "Œuf"], ["monster", "Monstre (départ)"]].forEach(([kind, text]) => {
    const item = document.createElement("li");
    item.innerHTML = `<i class="${kind}" aria-hidden="true"></i>`;
    item.append(text);
    legend.appendChild(item);
  });

  prev.addEventListener("click", () => { if (state.step > 0) { state.step--; draw(); } });
  next.addEventListener("click", () => { if (state.step < prepare(views[state.view]).turns.length) { state.step++; draw(); } });
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;
    if (event.key === "ArrowLeft") prev.click();
    if (event.key === "ArrowRight") next.click();
  });

  fill();
  draw();
})();
