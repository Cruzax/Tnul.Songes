// Solveur du combat des Souffles du Reflet (quête « En ce jardin qui nous unit », Dorigami).
// Règles (guide Dofus pour les Noobs): rendre les 20 Souffles de la même couleur. 50 PV, 10 PA, 1 PM, -1 PV par tour.
// - Vibration Paradoxale (1 PA, 1 PV, 10 par tour): Souffle en ligne avec toi, ligne de vue, portée infinie.
//   Un noir est repoussé d'une case, un blanc attiré d'une case; il change de couleur, ainsi que tous les Souffles
//   alignés (même ligne ou même colonne) avec sa case d'arrivée.
// - Réciprocité (2 PA, 3 PV, 1 par tour, relance 2): Souffle à 2-5 cases, sans ligne de vue; tu échanges ta place
//   avec lui, même changement de couleur autour de sa case d'arrivée (ta case de départ).
// Script classique: expose SouffleSolver (navigateur et worker) et module.exports (tests Node).
(function (root) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (a, b) => a + "," + b;

  // Carte: '.' sol, '#' obstacle (bloque la ligne de vue), ' ' vide (ne bloque pas la vue, pas de sol)
  function makeGame(def, options) {
    const floor = new Set();
    const walls = new Set();
    def.map.rows.forEach((row, line) => {
      [...row].forEach((ch, column) => {
        const k = key(def.map.amin + column, def.map.bmin + line);
        if (ch === ".") floor.add(k);
        if (ch === "#") walls.add(k);
      });
    });
    return {
      floor,
      walls,
      pa: def.pa || 10,
      pm: def.pm || 1,
      // firstOnly: seul le premier Souffle de chaque côté change de couleur (variante, si le jeu fait ainsi)
      firstOnly: Boolean(options && options.firstOnly),
    };
  }

  // État: joueur, Souffles (positions + couleurs), PV, PA et PM restants, relance de Réciprocité
  function initialState(def) {
    return {
      player: def.player.slice(),
      souffles: def.souffles.map((s) => ({ id: s.id, cell: s.cell.slice(), color: s.color })),
      hp: def.hp || 50,
      pa: def.pa || 10,
      pm: def.pm || 1,
      recip: 0,
      recipUsed: false,
    };
  }

  const clone = (s) => ({ ...s, player: s.player.slice(), souffles: s.souffles.map((x) => ({ ...x, cell: x.cell.slice() })) });
  const occupant = (s, a, b) => s.souffles.findIndex((x) => x.cell[0] === a && x.cell[1] === b);
  const free = (game, s, a, b) => game.floor.has(key(a, b)) && occupant(s, a, b) < 0 && !(s.player[0] === a && s.player[1] === b);

  // Souffles alignés avec (a, b): dans les 4 directions, tous ou seulement le premier rencontré
  function aligned(game, s, a, b, skip) {
    const out = [];
    s.souffles.forEach((x, i) => {
      if (i === skip) return;
      if (x.cell[0] !== a && x.cell[1] !== b) return;
      out.push(i);
    });
    if (!game.firstOnly) return out;
    const best = new Map();
    out.forEach((i) => {
      const [x, y] = s.souffles[i].cell;
      const dir = x === a ? (y > b ? "S" : "N") : (x > a ? "E" : "W");
      const dist = Math.abs(x - a) + Math.abs(y - b);
      if (!best.has(dir) || dist < best.get(dir)[1]) best.set(dir, [i, dist]);
    });
    return [...best.values()].map(([i]) => i);
  }

  function flipAround(game, s, index) {
    const target = s.souffles[index];
    target.color = target.color === "n" ? "b" : "n";
    aligned(game, s, target.cell[0], target.cell[1], index).forEach((i) => {
      s.souffles[i].color = s.souffles[i].color === "n" ? "b" : "n";
    });
  }

  // Ligne de vue en ligne droite: aucun obstacle ni Souffle entre toi et la cible
  function inSight(game, s, index) {
    const [pa, pb] = s.player;
    const [ta, tb] = s.souffles[index].cell;
    if (pa !== ta && pb !== tb) return false;
    const da = Math.sign(ta - pa);
    const db = Math.sign(tb - pb);
    for (let a = pa + da, b = pb + db; a !== ta || b !== tb; a += da, b += db) {
      if (game.walls.has(key(a, b)) || occupant(s, a, b) >= 0) return false;
    }
    return true;
  }

  // Actions possibles: { type: "vib" | "recip", id } sur un Souffle, { type: "move", to }, { type: "end" }
  function actions(game, s) {
    const out = [];
    if (s.pa >= 1 && s.hp > 1) {
      s.souffles.forEach((x, i) => {
        if (inSight(game, s, i)) out.push({ type: "vib", id: x.id, index: i });
      });
    }
    if (s.pa >= 2 && s.hp > 3 && s.recip === 0 && !s.recipUsed) {
      s.souffles.forEach((x, i) => {
        const d = Math.abs(x.cell[0] - s.player[0]) + Math.abs(x.cell[1] - s.player[1]);
        if (d >= 2 && d <= 5) out.push({ type: "recip", id: x.id, index: i });
      });
    }
    if (s.pm > 0) {
      DIRS.forEach(([da, db]) => {
        const to = [s.player[0] + da, s.player[1] + db];
        if (free(game, s, to[0], to[1])) out.push({ type: "move", to });
      });
    }
    out.push({ type: "end" });
    return out;
  }

  function apply(game, state, action) {
    const s = clone(state);
    if (action.type === "end") {
      s.hp -= 1;
      s.pa = game.pa;
      s.pm = game.pm;
      s.recip = Math.max(0, s.recip - 1);
      s.recipUsed = false;
      return s.hp > 0 ? s : null;
    }
    if (action.type === "move") {
      s.player = action.to.slice();
      s.pm -= 1;
      return s;
    }
    const i = action.index;
    const target = s.souffles[i];
    if (action.type === "vib") {
      s.pa -= 1;
      s.hp -= 1;
      // Noir repoussé, blanc attiré, d'une case dans l'axe joueur-cible (reste sur place si la case est prise)
      const da = Math.sign(target.cell[0] - s.player[0]);
      const db = Math.sign(target.cell[1] - s.player[1]);
      const step = target.color === "n" ? 1 : -1;
      const to = [target.cell[0] + da * step, target.cell[1] + db * step];
      if (free(game, s, to[0], to[1])) target.cell = to;
    } else {
      s.pa -= 2;
      s.hp -= 3;
      s.recip = 2;
      s.recipUsed = true;
      const old = s.player;
      s.player = target.cell;
      target.cell = old;
    }
    flipAround(game, s, i);
    return s.hp > 0 ? s : null;
  }

  const wrong = (s, color) => s.souffles.reduce((n, x) => n + (x.color === color ? 0 : 1), 0);
  const stateKey = (s) => s.player.join(",") + "|" + s.pa + s.pm + s.recip + (s.recipUsed ? 1 : 0) + "|"
    + s.souffles.map((x) => x.cell.join(",") + x.color).join(";");

  // Recherche en faisceau: à chaque coup, garde les meilleurs états (moins de Souffles de la mauvaise couleur,
  // puis le plus de PV). Essaie les deux couleurs et rend le plan qui coûte le moins de PV.
  function solve(game, start, options) {
    const opts = { beam: 600, maxSteps: 140, ...(options || {}) };
    let best = null;
    for (const color of ["n", "b"]) {
      let layer = [{ s: start, path: [] }];
      const seen = new Set([stateKey(start)]);
      for (let step = 0; step < opts.maxSteps && layer.length; step++) {
        const next = [];
        for (const node of layer) {
          for (const action of actions(game, node.s)) {
            const s = apply(game, node.s, action);
            if (!s) continue;
            const k = stateKey(s);
            if (seen.has(k)) continue;
            seen.add(k);
            const path = node.path.concat([action]);
            if (wrong(s, color) === 0) {
              if (!best || s.hp > best.hp) best = { hp: s.hp, color, path, end: s };
              continue;
            }
            next.push({ s, path, score: wrong(s, color) * 4 - s.hp * 0.15 - s.pa * 0.05 });
          }
        }
        if (best && best.color === color) break;
        next.sort((x, y) => x.score - y.score);
        layer = next.slice(0, opts.beam);
      }
    }
    return best;
  }

  const api = { makeGame, initialState, actions, apply, solve, wrong };
  root.SouffleSolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
