// Solveur du combat « Ce qui est » (La fin... ou le commencement, 2e combat): amener les 4 petites machines
// sur les 4 glyphes autour de la grosse machine. Règle du guide: frapper une petite machine en étant aligné
// avec elle l'attire jusqu'à ton corps à corps. Elle avance case par case vers toi et s'arrête avant un trou,
// une autre machine ou toi. Le joueur joue sa propre classe: le solveur donne où se placer, pas comment y aller.
// Script classique: expose MachineSolver (navigateur) et module.exports (tests Node).
(function (root) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (c) => c[0] + "," + c[1];
  const same = (p, q) => p[0] === q[0] && p[1] === q[1];

  // '.' sol, 'o' trou (ne bloque pas la vue, pas de sol), ' ' hors carte
  function makeGame(def) {
    const floor = new Set();
    def.map.rows.forEach((row, line) => {
      [...row].forEach((ch, column) => {
        if (ch === ".") floor.add(key([def.map.amin + column, def.map.bmin + line]));
      });
    });
    floor.delete(key(def.center));
    return { floor, center: def.center, glyphs: def.glyphs };
  }

  // Une attraction depuis la case du joueur: la machine glisse vers lui tant que la case suivante est libre
  function pull(game, blocked, machine, player) {
    const d = [Math.sign(player[0] - machine[0]), Math.sign(player[1] - machine[1])];
    let at = machine;
    for (;;) {
      const nextCell = [at[0] + d[0], at[1] + d[1]];
      if (same(nextCell, player) || !game.floor.has(key(nextCell)) || blocked.has(key(nextCell))) return at;
      at = nextCell;
    }
  }

  // Ligne de vue entre le joueur et la machine: seules les autres machines (et la grosse) la coupent
  function inSight(blocked, center, from, to) {
    const d = [Math.sign(to[0] - from[0]), Math.sign(to[1] - from[1])];
    for (let c = [from[0] + d[0], from[1] + d[1]]; !same(c, to); c = [c[0] + d[0], c[1] + d[1]]) {
      if (blocked.has(key(c)) || same(c, center)) return false;
    }
    return true;
  }

  // Plus courte suite d'attractions pour amener une machine sur une case (les autres machines restent fixes)
  function route(game, blocked, from, goal, maxRange) {
    const came = new Map([[key(from), null]]);
    const queue = [from];
    while (queue.length) {
      const m = queue.shift();
      if (same(m, goal)) break;
      for (const d of DIRS) {
        for (let k = 2; k <= maxRange; k++) {
          const p = [m[0] + d[0] * k, m[1] + d[1] * k];
          if (!game.floor.has(key(p)) || blocked.has(key(p))) continue;
          if (!inSight(blocked, game.center, p, m)) break;
          const to = pull(game, blocked, m, p);
          if (same(to, m) || came.has(key(to))) continue;
          came.set(key(to), { from: m, player: p });
          queue.push(to);
        }
      }
    }
    if (!came.has(key(goal))) return null;
    const steps = [];
    for (let at = goal; came.get(key(at)); at = came.get(key(at)).from) {
      const { from: m, player } = came.get(key(at));
      steps.unshift({ player, from: m, to: at });
    }
    return steps;
  }

  // Essaie tous les ordres de machines et toutes les répartitions sur les glyphes: le moins d'attractions,
  // puis le moins de chemin à faire entre deux frappes (distance à vol d'oiseau en cases)
  function solve(game, def, options) {
    const maxRange = (options && options.range) || 6;
    // Même machine, même but, mêmes machines autour: même chemin (les ordres testés se recoupent beaucoup)
    const memo = new Map();
    const cachedRoute = (blocked, from, goal) => {
      const k = [key(from), key(goal), [...blocked].sort().join(";")].join("|");
      if (!memo.has(k)) memo.set(k, route(game, blocked, from, goal, maxRange));
      return memo.get(k);
    };
    const machines = def.machines.map((m) => ({ id: m.id, cell: m.cell.slice() }));
    let best = null;
    const permute = (list) => (list.length <= 1 ? [list] : list.flatMap((x, i) => permute(list.filter((_, j) => j !== i)).map((rest) => [x, ...rest])));
    const glyphOrders = permute(game.glyphs.map((g, i) => i));
    for (const order of permute(machines.map((m, i) => i))) {
      for (const slots of glyphOrders) {
        const cells = machines.map((m) => m.cell.slice());
        let player = def.player.slice();
        const plan = [];
        let walk = 0;
        let ok = true;
        for (let n = 0; n < order.length && ok; n++) {
          const i = order[n];
          const goal = game.glyphs[slots[n]];
          const blocked = new Set(cells.filter((_, j) => j !== i).map(key));
          const steps = cachedRoute(blocked, cells[i], goal);
          if (!steps) { ok = false; break; }
          steps.forEach((step) => {
            walk += Math.abs(step.player[0] - player[0]) + Math.abs(step.player[1] - player[1]);
            player = step.player;
            plan.push({ id: machines[i].id, ...step });
          });
          cells[i] = goal;
          if (best && plan.length > best.plan.length) ok = false;
        }
        if (!ok) continue;
        if (!best || plan.length < best.plan.length || (plan.length === best.plan.length && walk < best.walk)) best = { plan, walk };
      }
    }
    return best;
  }

  const api = { makeGame, pull, route, solve };
  root.MachineSolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
