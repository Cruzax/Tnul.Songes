// Solveur du combat « Une âme en peine » (labyrinthe du Minogolem).
// Règles d'un tour: -1 PV et relances -1, ton action, le Minogolem Séculaire échange sa place avec celui annoncé
// (Sang / Sel / Or), puis un mur apparaît sur ta case voisine opposée au coin où se trouve le Séculaire.
(function (root) {
  const DIRS = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };
  const DIR_KEYS = ["N", "S", "W", "E"];
  const OPPOSITE = { N: "S", S: "N", W: "E", E: "W" };
  const COOLDOWN = 10;
  const config = { beam: 200, risk: 0.35, wait: 0.35, marginTarget: 3, marginWeight: 8 };

  const key = (p) => p[0] + "," + p[1];
  const add = (p, d) => [p[0] + d[0], p[1] + d[1]];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];

  function makeGame(def, options) {
    return { grid: def.grid, goal: def.goal, pushMoves: Boolean(options && options.pushMoves) };
  }

  function blocked(game, p, walls) {
    const row = game.grid[p[0]];
    return !row || row[p[1]] === undefined || row[p[1]] === "#" || walls.has(key(p));
  }

  const distCache = new Map();
  function distance(game, from, walls) {
    const cacheKey = key(from) + "|" + [...walls].sort().join(";");
    if (distCache.has(cacheKey)) {
      return distCache.get(cacheKey);
    }
    let result = 999;
    if (same(from, game.goal)) {
      result = 0;
    } else {
      const queue = [[from, 0]];
      const seen = new Set([key(from)]);
      for (let head = 0; head < queue.length && result === 999; head += 1) {
        const [pos, d] = queue[head];
        for (const dir of DIR_KEYS) {
          const next = add(pos, DIRS[dir]);
          if (seen.has(key(next)) || blocked(game, next, walls)) {
            continue;
          }
          if (same(next, game.goal)) {
            result = d + 1;
            break;
          }
          seen.add(key(next));
          queue.push([next, d + 1]);
        }
      }
    }
    if (distCache.size > 200000) {
      distCache.clear();
    }
    distCache.set(cacheKey, result);
    return result;
  }

  function swapSeculaire(corners, target) {
    const next = { ...corners };
    const from = DIR_KEYS.find((k) => next[k] === "seculaire");
    const to = DIR_KEYS.find((k) => next[k] === target);
    next[from] = target;
    next[to] = "seculaire";
    return next;
  }

  function spawnCell(pos, corners) {
    const at = DIR_KEYS.find((k) => corners[k] === "seculaire");
    return add(pos, DIRS[OPPOSITE[at]]);
  }

  // Un tour complet: tick, action, échange, mur. Renvoie le nouvel état, ou null si le joueur meurt.
  function step(game, state, action, info) {
    let s = { pos: state.pos, hp: state.hp - 1, cdB: Math.max(0, state.cdB - 1), cdC: Math.max(0, state.cdC - 1), walls: state.walls, corners: state.corners };
    if (s.hp <= 0) {
      return null;
    }
    if (action.reduce) {
      if (action.reduce >= s.hp) {
        return null;
      }
      s = { ...s, hp: s.hp - action.reduce, cdB: Math.max(0, s.cdB - action.reduce), cdC: Math.max(0, s.cdC - action.reduce) };
    }
    const m = action.move;
    if (m) {
      if (m.type === "move") {
        s.pos = add(s.pos, DIRS[m.dir]);
      } else if (m.type === "dash") {
        s.pos = add(add(s.pos, DIRS[m.dirs[0]]), DIRS[m.dirs[1]]);
        s.cdB = COOLDOWN;
      } else if (m.type === "push") {
        const wall = add(s.pos, DIRS[m.dir]);
        const behind = add(wall, DIRS[m.dir]);
        const walls = new Set(s.walls);
        walls.delete(key(wall));
        walls.add(key(behind));
        s.walls = walls;
        s.cdC = COOLDOWN;
        if (game.pushMoves) {
          s.pos = wall;
        }
      }
    }
    if (same(s.pos, game.goal)) {
      return { ...s, won: true };
    }
    if (info) {
      s.corners = swapSeculaire(s.corners, info);
      const cell = spawnCell(s.pos, s.corners);
      if (!blocked(game, cell, s.walls)) {
        const walls = new Set(s.walls);
        walls.add(key(cell));
        s.walls = walls;
      }
    }
    return s;
  }

  // Actions possibles ce tour (état déjà décrémenté par le tick).
  function actionsFor(game, s) {
    const out = [];
    const reductions = [0];
    if (s.cdB > 0) reductions.push(s.cdB);
    if (s.cdC > 0 && s.cdC !== s.cdB) reductions.push(s.cdC);
    for (const reduce of reductions) {
      if (reduce >= s.hp) continue;
      const cdB = Math.max(0, s.cdB - reduce);
      const cdC = Math.max(0, s.cdC - reduce);
      out.push({ reduce, move: null, cost: reduce * 0.1 + config.wait });
      for (const dir of DIR_KEYS) {
        if (!blocked(game, add(s.pos, DIRS[dir]), s.walls)) {
          out.push({ reduce, move: { type: "move", dir }, cost: reduce * 0.1 });
        }
      }
      if (cdB === 0) {
        for (const d1 of DIR_KEYS) {
          const p1 = add(s.pos, DIRS[d1]);
          if (blocked(game, p1, s.walls)) continue;
          for (const d2 of DIR_KEYS) {
            if (blocked(game, add(p1, DIRS[d2]), s.walls)) continue;
            out.push({ reduce, move: { type: "dash", dirs: [d1, d2] }, cost: reduce * 0.1 });
          }
        }
      }
      if (cdC === 0) {
        for (const dir of DIR_KEYS) {
          const wall = add(s.pos, DIRS[dir]);
          if (!s.walls.has(key(wall))) continue;
          if (blocked(game, add(wall, DIRS[dir]), s.walls)) continue;
          out.push({ reduce, move: { type: "push", dir }, cost: reduce * 0.1 + 0.2 });
        }
      }
    }
    return out;
  }

  // Valeur d'un état: distance restante, avec un malus si un seul mur futur peut enfermer le joueur.
  function evaluate(game, s) {
    const d = distance(game, s.pos, s.walls);
    if (d >= 999) {
      return -1e6;
    }
    let worst = d;
    for (const dir of DIR_KEYS) {
      const cell = add(s.pos, DIRS[dir]);
      if (blocked(game, cell, s.walls)) continue;
      const walls = new Set(s.walls);
      walls.add(key(cell));
      worst = Math.max(worst, Math.min(60, distance(game, s.pos, walls)));
    }
    const margin = s.hp - d;
    // Chaque PV compte comme un tour: on vise la plus grande marge (PV restants moins cases à parcourir).
    return margin - config.risk * (worst - d) - (margin < config.marginTarget ? (config.marginTarget - margin) * config.marginWeight : 0) - (margin < 0 ? 200 : 0);
  }

  const stateKey = (s) => key(s.pos) + "|" + s.hp + "|" + s.cdB + "|" + s.cdC + "|" + DIR_KEYS.map((k) => s.corners[k][0]).join("") + "|" + [...s.walls].sort().join(";");

  // infos: liste de "sang" | "sel" | "or" (un par tour). Renvoie le meilleur plan sur tout l'horizon.
  function plan(game, state, infos) {
    let beam = [{ s: state, actions: [], score: 0, spent: 0 }];
    let best = null;
    let last = beam;
    for (let t = 0; t < infos.length; t += 1) {
      const next = new Map();
      for (const node of beam) {
        const ticked = { ...node.s, hp: node.s.hp - 1, cdB: Math.max(0, node.s.cdB - 1), cdC: Math.max(0, node.s.cdC - 1) };
        for (const action of actionsFor(game, ticked)) {
          const result = step(game, node.s, action, infos[t]);
          if (!result) continue;
          const spent = node.spent + action.cost;
          const actions = node.actions.concat([action]);
          if (result.won) {
            const candidate = { s: result, actions, score: 1e5 - actions.length * 10 - spent, spent, won: true };
            if (!best || candidate.score > best.score) best = candidate;
            continue;
          }
          const score = evaluate(game, result) * 10 - spent;
          const k = stateKey(result);
          const old = next.get(k);
          if (!old || old.score < score) {
            next.set(k, { s: result, actions, score, spent });
          }
        }
      }
      beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, config.beam);
      if (!beam.length) break;
      last = beam;
    }
    if (best) return best;
    return last.length ? last[0] : null;
  }

  // Joue les n premiers tours d'un plan sur l'état réel.
  function play(game, state, planned, infos, n) {
    let s = state;
    const states = [];
    for (let t = 0; t < Math.min(n, planned.actions.length); t += 1) {
      s = step(game, s, planned.actions[t], infos[t]);
      if (!s) break;
      states.push(s);
      if (s.won) break;
    }
    return { state: s, states };
  }

  const api = { config, DIRS, DIR_KEYS, OPPOSITE, makeGame, step, plan, play, swapSeculaire, spawnCell, distance, blocked, key, add, same, evaluate };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulMinogolem = api;
  }
})(typeof self !== "undefined" ? self : this);
