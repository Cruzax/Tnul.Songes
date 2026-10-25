// Page d'aide au combat du Minogolem: carte du labyrinthe, annonces du boss, plan de 4 tours.
(async function () {
  const S = window.TnulMinogolem;
  const SX = 30;
  const SY = 15;
  const SIDE = 11;
  const WALL_H = 10;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const NAMES = { sang: "Sang", sel: "Sel", or: "Or", seculaire: "Séculaire" };
  const DOT = { sang: "#ff7b86", sel: "#e6ecf5", or: "#f0c542", seculaire: "#6ebaed" };
  // Emplacement des coins à l'écran: le Nord est en haut à droite, l'Ouest en haut à gauche, etc.
  const CORNER_SCREEN = { W: "tl", N: "tr", S: "bl", E: "br" };
  const ARROW = { N: "↗", S: "↙", W: "↖", E: "↘" };
  const ARROW_NAME = { N: "haut-droite", S: "bas-gauche", W: "haut-gauche", E: "bas-droite" };
  const EDITABLE = [0, 1, 4, 5];

  const el = (id) => document.getElementById(id);
  const board = el("mg-board");
  const slotsNode = el("mg-slots");
  const messageNode = el("mg-message");

  let def;
  try {
    def = await fetch("data/minogolem.json").then((response) => response.json());
  } catch (error) {
    board.replaceWith(Object.assign(document.createElement("p"), { textContent: "Impossible de charger la carte." }));
    console.error("Erreur de chargement:", error.message);
    return;
  }

  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
    if (parent) {
      parent.appendChild(node);
    }
    return node;
  };
  const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(" ");
  const keyOf = (p) => p[0] + "," + p[1];

  // Carte: (ligne, colonne) de la grille -> case isométrique. La ligne descend vers le bas-gauche, la colonne vers le bas-droite.
  const toXY = (r, c) => ({ x: (c - r) * SX, y: (r + c - 2) * SY });
  const open = [];
  def.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== "#") {
      open.push([r, c]);
    }
  }));
  const isOpen = (r, c) => Boolean(def.grid[r]) && def.grid[r][c] !== undefined && def.grid[r][c] !== "#";

  function freshState() {
    return { pos: def.start.slice(), hp: def.hp - 1, cdB: 0, cdC: 0, walls: new Set(), corners: { ...def.corners } };
  }

  const ui = { state: freshState(), slots: Array(8).fill(""), active: 0, plan: null, step: 0, pushMoves: false, busy: false, won: false };

  // ---- Annonces: les tours 3 et 4 de chaque bloc se déduisent des tours 1 et 2 ----
  const VALUES = ["sang", "sel", "or"];
  function inferred(index) {
    const start = index < 4 ? 0 : 4;
    const a = ui.slots[start];
    const b = ui.slots[start + 1];
    if (!a || !b || a === b) {
      return "";
    }
    return index === start + 2 ? VALUES.find((v) => v !== a && v !== b) : b;
  }
  const slotValue = (index) => (EDITABLE.includes(index) ? ui.slots[index] : inferred(index));

  function blockInfos(start) {
    const values = [0, 1, 2, 3].map((n) => slotValue(start + n));
    return values.every(Boolean) ? values : null;
  }
  function currentInfos() {
    const first = blockInfos(0);
    if (!first) {
      return null;
    }
    const second = blockInfos(4);
    return second ? first.concat(second) : first;
  }

  // ---- Dessin ----
  function viewState() {
    return ui.step === 0 || !ui.plan ? ui.state : ui.plan.states[ui.step - 1];
  }

  function draw() {
    const view = viewState();
    const prev = ui.step > 1 ? ui.plan.states[ui.step - 2] : ui.state;
    board.innerHTML = "";

    const xs = open.map(([r, c]) => toXY(r, c).x);
    const ys = open.map(([r, c]) => toXY(r, c).y);
    const minX = Math.min(...xs) - SX;
    const maxX = Math.max(...xs) + SX;
    const minY = Math.min(...ys) - SY - WALL_H;
    const maxY = Math.max(...ys) + SY + SIDE;
    const pad = 46;
    board.setAttribute("viewBox", `${minX - 4} ${minY - pad} ${maxX - minX + 8} ${maxY - minY + pad * 2}`);

    const slabLayer = svg("g", {}, board);
    const cellLayer = svg("g", {}, board);
    const wallLayer = svg("g", {}, board);
    const topLayer = svg("g", {}, board);

    const trail = new Set();
    if (ui.plan && ui.step > 0) {
      trail.add(keyOf(ui.state.pos));
      ui.plan.states.slice(0, ui.step).forEach((s) => trail.add(keyOf(s.pos)));
    }

    open.forEach(([r, c]) => {
      const { x, y } = toXY(r, c);
      if (!isOpen(r + 1, c)) {
        svg("polygon", { class: "mg-slab-l", points: pts([[x - SX, y], [x, y + SY], [x, y + SY + SIDE], [x - SX, y + SIDE]]) }, slabLayer);
      }
      if (!isOpen(r, c + 1)) {
        svg("polygon", { class: "mg-slab-r", points: pts([[x, y + SY], [x + SX, y], [x + SX, y + SIDE], [x, y + SY + SIDE]]) }, slabLayer);
      }
      const cls = ["mg-cell"];
      if ((c - r) % 2) cls.push("alt");
      if (r === def.goal[0] && c === def.goal[1]) cls.push("goal");
      else if (trail.has(r + "," + c)) cls.push("trail");
      if (r === def.start[0] && c === def.start[1]) cls.push("start");
      const cell = svg("polygon", { class: cls.join(" "), points: pts([[x, y - SY], [x + SX, y], [x, y + SY], [x - SX, y]]) }, cellLayer);
      cell.dataset.r = r;
      cell.dataset.c = c;
    });

    [...view.walls].map((k) => k.split(",").map(Number)).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([r, c]) => {
      const { x, y } = toXY(r, c);
      const up = y - WALL_H;
      const fresh = !prev.walls.has(r + "," + c) && ui.step > 0;
      const group = svg("g", { class: "mg-wall" + (fresh ? " new" : "") }, wallLayer);
      svg("polygon", { class: "mg-wall-l", points: pts([[x - SX, up], [x, up + SY], [x, y + SY], [x - SX, y]]) }, group);
      svg("polygon", { class: "mg-wall-r", points: pts([[x + SX, up], [x, up + SY], [x, y + SY], [x + SX, y]]) }, group);
      svg("polygon", { class: "mg-wall-top", points: pts([[x - SX, up], [x, up - SY], [x + SX, up], [x, up + SY]]) }, group);
    });

    const me = toXY(view.pos[0], view.pos[1]);
    const player = svg("g", { class: "mg-player" }, topLayer);
    svg("ellipse", { class: "mg-player-shadow", cx: me.x, cy: me.y + 3, rx: 11, ry: 5 }, player);
    svg("circle", { class: "mg-player-body", cx: me.x, cy: me.y - 7, r: 8 }, player);

    // Les 4 Minogolems aux coins de l'écran
    const left = minX - 4;
    const top = minY - pad;
    const width = maxX - minX + 8;
    const height = maxY - minY + pad * 2;
    const spots = { tl: [left + 6, top + 6], tr: [left + width - 96, top + 6], bl: [left + 6, top + height - 30], br: [left + width - 96, top + height - 30] };
    Object.entries(view.corners).forEach(([corner, who]) => {
      const [bx, by] = spots[CORNER_SCREEN[corner]];
      const group = svg("g", { class: "mg-corner" + (who === "seculaire" ? " boss" : "") }, topLayer);
      svg("rect", { x: bx, y: by, width: 90, height: 24, rx: 6 }, group);
      svg("circle", { class: "dot", cx: bx + 12, cy: by + 12, r: 5, fill: DOT[who] }, group);
      svg("text", { x: bx + 24, y: by + 16 }, group).textContent = NAMES[who];
    });
  }

  // ---- Panneau ----
  function renderSlots() {
    slotsNode.innerHTML = "";
    for (let i = 0; i < 8; i += 1) {
      const editable = EDITABLE.includes(i);
      const value = slotValue(i);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mg-slot" + (editable ? "" : " auto") + (editable && ui.active === i ? " active" : "") + (value ? "" : " empty");
      button.dataset.value = value;
      button.disabled = !editable;
      const small = document.createElement("small");
      small.textContent = String(i + 1);
      button.append(small, value ? NAMES[value] : "–");
      if (editable) {
        button.addEventListener("click", () => {
          ui.active = i;
          renderSlots();
        });
      }
      slotsNode.appendChild(button);
    }
    el("mg-play").disabled = ui.busy || ui.won || !currentInfos();
  }

  function describe(action, t) {
    const parts = [];
    if (action.reduce) {
      parts.push(`Placidité ×${action.reduce} (−${action.reduce} PV)`);
    }
    const m = action.move;
    if (!m) {
      parts.push("Ne bouge pas");
      return { arrow: "·", text: parts.join(" puis ") };
    }
    if (m.type === "move") {
      return { arrow: ARROW[m.dir], text: parts.concat([`Avance ${ARROW_NAME[m.dir]}`]).join(" puis ") };
    }
    if (m.type === "dash") {
      return { arrow: ARROW[m.dirs[0]] + ARROW[m.dirs[1]], text: parts.concat([`Déplacement rapide: ${ARROW_NAME[m.dirs[0]]}, puis ${ARROW_NAME[m.dirs[1]]}`]).join(" puis ") };
    }
    return { arrow: ARROW[m.dir], text: parts.concat([`Décalage sur le mur ${ARROW_NAME[m.dir]}`]).join(" puis ") };
  }

  function renderPlan() {
    const card = el("mg-plan-card");
    card.hidden = !ui.plan;
    const list = el("mg-plan");
    list.innerHTML = "";
    if (!ui.plan) {
      return;
    }
    ui.plan.actions.slice(0, 4).forEach((action, index) => {
      const info = describe(action, index);
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
      item.addEventListener("click", () => {
        ui.step = Math.min(index + 1, ui.plan.states.length);
        refresh();
      });
      list.appendChild(item);
    });
  }

  function renderStepBar() {
    const total = ui.plan ? ui.plan.states.length : 0;
    el("mg-prev").disabled = ui.step === 0;
    el("mg-next").disabled = ui.step >= total;
    const view = viewState();
    el("mg-step-label").textContent = (ui.step === 0 ? "État actuel" : `Après le tour ${ui.step}`) + ` · ${view.hp} PV`;
  }

  function setMessage(text, ok) {
    messageNode.textContent = text || "";
    messageNode.classList.toggle("ok", Boolean(ok));
  }

  function syncFields() {
    el("mg-hp").value = ui.state.hp;
    el("mg-cdb").value = ui.state.cdB;
    el("mg-cdc").value = ui.state.cdC;
  }

  function refresh() {
    draw();
    renderSlots();
    renderPlan();
    renderStepBar();
    syncFields();
  }

  // ---- Calcul ----
  let worker = null;
  let requestId = 0;
  const pending = new Map();
  try {
    worker = new Worker("assets/js/minogolem/worker.js");
    worker.onmessage = (event) => {
      const done = pending.get(event.data.id);
      if (done) {
        pending.delete(event.data.id);
        done(event.data.plan);
      }
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch (error) {
    worker = null;
  }

  function computePlan(infos) {
    const options = { pushMoves: ui.pushMoves };
    const payload = { def, options, state: { ...ui.state, walls: [...ui.state.walls] }, infos };
    if (worker) {
      return new Promise((resolve) => {
        const id = (requestId += 1);
        pending.set(id, resolve);
        worker.postMessage({ id, ...payload });
      }).then((plan) => (plan ? { ...plan, states: plan.states.map((s) => ({ ...s, walls: new Set(s.walls) })) } : null));
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        const game = S.makeGame(def, options);
        const planned = S.plan(game, { ...ui.state }, infos);
        if (!planned) {
          resolve(null);
          return;
        }
        resolve({ actions: planned.actions, won: Boolean(planned.won), states: S.play(game, { ...ui.state }, planned, infos, 4).states });
      }, 20);
    });
  }

  async function play() {
    const infos = currentInfos();
    if (!infos) {
      return;
    }
    ui.busy = true;
    setMessage("Calcul en cours…");
    renderSlots();
    const plan = await computePlan(infos);
    ui.busy = false;
    if (!plan || !plan.states.length) {
      ui.plan = null;
      setMessage("Aucun plan possible depuis cette position (PV ou couloirs). Vérifie ton état ou recommence.");
    } else {
      ui.plan = plan;
      ui.step = 0;
      const last = plan.states[Math.min(3, plan.states.length - 1)];
      setMessage(last.won ? "Arrivée en vue: ce bloc te mène à la case verte !" : infos.length < 8 ? "Plan calculé avec un seul bloc connu: entre aussi le suivant pour plus de sûreté." : "", last.won);
    }
    refresh();
  }

  function apply() {
    if (!ui.plan) {
      return;
    }
    const last = ui.plan.states[ui.plan.states.length - 1];
    ui.state = { ...last, walls: new Set(last.walls) };
    ui.plan = null;
    ui.step = 0;
    if (last.won) {
      ui.won = true;
      setMessage("Bravo, tu es arrivé sur la case verte !", true);
    } else {
      ui.slots = ui.slots.slice(4).concat(["", "", "", ""]);
      ui.active = 4;
      setMessage("");
    }
    refresh();
  }

  function reset() {
    ui.state = freshState();
    ui.slots = Array(8).fill("");
    ui.active = 0;
    ui.plan = null;
    ui.step = 0;
    ui.won = false;
    setMessage("");
    refresh();
  }

  // ---- Événements ----
  function pickValue(value) {
    const index = ui.active;
    if (!EDITABLE.includes(index)) {
      return;
    }
    const partner = index % 4 === 0 ? index + 1 : index - 1;
    if (value && ui.slots[partner] === value) {
      setMessage("Les deux premières annonces d'un bloc sont toujours différentes.");
      return;
    }
    setMessage("");
    ui.slots[index] = value;
    ui.plan = null;
    ui.step = 0;
    if (value) {
      const next = EDITABLE.find((n) => n > index && !ui.slots[n]);
      ui.active = next === undefined ? index : next;
    }
    refresh();
  }
  document.querySelectorAll(".mg-pick").forEach((button) => {
    button.addEventListener("click", () => pickValue(button.dataset.value));
  });
  el("mg-play").addEventListener("click", play);
  el("mg-apply").addEventListener("click", apply);
  el("mg-reset").addEventListener("click", reset);
  el("mg-prev").addEventListener("click", () => {
    ui.step = Math.max(0, ui.step - 1);
    refresh();
  });
  el("mg-next").addEventListener("click", () => {
    ui.step = Math.min(ui.plan ? ui.plan.states.length : 0, ui.step + 1);
    refresh();
  });

  const clampField = (id, min, max) => Math.min(max, Math.max(min, Math.round(Number(el(id).value)) || 0));
  function fieldChange() {
    ui.state = { ...ui.state, hp: clampField("mg-hp", 1, 100), cdB: clampField("mg-cdb", 0, 10), cdC: clampField("mg-cdc", 0, 10) };
    ui.plan = null;
    ui.step = 0;
    refresh();
  }
  ["mg-hp", "mg-cdb", "mg-cdc"].forEach((id) => el(id).addEventListener("change", fieldChange));
  el("mg-push-moves").addEventListener("change", (event) => {
    ui.pushMoves = event.target.checked;
    ui.plan = null;
    ui.step = 0;
    refresh();
  });

  function cellOf(event) {
    const node = event.target;
    return node.dataset && node.dataset.r !== undefined ? [Number(node.dataset.r), Number(node.dataset.c)] : null;
  }
  board.addEventListener("click", (event) => {
    const cell = cellOf(event);
    if (!cell || ui.step !== 0) {
      return;
    }
    const walls = new Set(ui.state.walls);
    walls.delete(keyOf(cell));
    ui.state = { ...ui.state, pos: cell, walls };
    ui.plan = null;
    refresh();
  });
  board.addEventListener("contextmenu", (event) => {
    const cell = cellOf(event);
    event.preventDefault();
    if (!cell || ui.step !== 0 || S.same(cell, ui.state.pos) || S.same(cell, def.goal)) {
      return;
    }
    const walls = new Set(ui.state.walls);
    if (!walls.delete(keyOf(cell))) {
      walls.add(keyOf(cell));
    }
    ui.state = { ...ui.state, walls };
    ui.plan = null;
    refresh();
  });

  refresh();
})();
