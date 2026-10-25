// Recherche en faisceau (beam search) d'une suite d'actions qui tue tous les feux sans mourir.
(function (root) {
  const E = root.TnulBolgrotEngine || require("./engine.js");

  const config = { beam: 400, layers: 300, perBucket: 40, killBonus: 30, pvWeight: 2, openWeight: 6, adjPenalty: 0, nearBonus: 0, prefilter: 4, pvTier: 6, minQuota: 4,
    mode: "classic", select: "bucket", wEnemies: -1200, wPv: 420, wMobility: 900, wKills: 900, wRay: 16000, rayStepScale: 1, wLine: 3600, wAlign: 180, wOver2: 7200, wAdjacent: 9200 };

  const keyOf = (s) => s.p + "|" + s.pa + "|" + s.doubles + "|" + (s.turn <= 6 ? s.turn : 0) + "|" + s.fires.slice().sort((a, b) => a - b).join(",");

  // Nombre de sauts qui tuent un feu sans danger depuis cet état.
  function killOptions(ctx, state) {
    const fireSet = new Set(state.fires);
    let n = 0;
    for (const [dx, dy] of E.ORTHO) {
      for (const dist of [1, 2]) {
        const x = E.gx(state.p) + dx * dist;
        const y = E.gy(state.p) + dy * dist;
        if (x < 0 || x >= E.W || y < 0 || y >= E.H) continue;
        if (!fireSet.has(y * E.W + x)) continue;
        const kind = dist === 1 ? "astral" : "double";
        if (E.apply(ctx, state, { kind, dx, dy })) n += 1;
      }
    }
    return n;
  }

  // Nombre d'actions autres que « fin de tour » qui restent possibles (la liberté de manœuvre).
  function openActions(ctx, state) {
    let n = 0;
    for (const action of E.actionsOf(state)) {
      if (action.kind !== "end" && E.apply(ctx, state, action)) n += 1;
    }
    return n;
  }

  // Santé d'un état à nombre de feux égal: manœuvre possible, kills sûrs, PV.
  // Paires de feux voisins (agglutinées) et feux proches du joueur sur ses axes.
  function shape(state) {
    const set = new Set(state.fires);
    let adj = 0;
    let near = 0;
    const px = E.gx(state.p);
    const py = E.gy(state.p);
    for (const f of state.fires) {
      const x = E.gx(f);
      const y = E.gy(f);
      for (const [dx, dy] of E.ORTHO) {
        if (set.has((y + dy) * E.W + x + dx)) adj += 1;
      }
      if ((x === px || y === py) && Math.abs(x - px) + Math.abs(y - py) <= 3) near += 1;
    }
    return { adj: adj / 2, near };
  }

  // Une seule passe sur les actions: combien sont possibles, et combien tuent un feu.
  function mobility(ctx, state) {
    let open = 0;
    let kills = 0;
    for (const action of E.actionsOf(state)) {
      if (action.kind === "end") continue;
      const result = E.apply(ctx, state, action);
      if (!result) continue;
      open += 1;
      if (result.fires.length < state.fires.length) kills += 1;
    }
    return { open, kills };
  }

  // Mesures sur la forme des feux autour du joueur.
  const RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  function lineFeatures(ctx, state) {
    const set = new Set(state.fires);
    const px = E.gx(state.p);
    const py = E.gy(state.p);
    let maxRay = 0;
    for (const [dx, dy] of RAYS) {
      let count = 0;
      let consecutive = 0;
      let gap = false;
      let x = px + dx;
      let y = py + dy;
      while (x >= 0 && x < E.W && y >= 0 && y < E.H) {
        const c = y * E.W + x;
        if (ctx.blocked[c]) break;
        if (set.has(c)) {
          count += 1;
          if (!gap) consecutive += 1;
        } else if (count > 0) gap = true;
        x += dx;
        y += dy;
      }
      maxRay = Math.max(maxRay, count * 2 + consecutive);
    }
    const lines = [new Map(), new Map(), new Map(), new Map()];
    let adjacent = 0;
    let near2 = 0;
    for (const fire of state.fires) {
      const x = E.gx(fire);
      const y = E.gy(fire);
      const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
      bump(lines[0], y);
      bump(lines[1], x);
      bump(lines[2], x - y);
      bump(lines[3], x + y);
      const d = Math.max(Math.abs(x - px), Math.abs(y - py));
      if (d <= 1) adjacent += 1;
      if (d <= 2) near2 += 1;
    }
    let maxLine = 0;
    let alignment = 0;
    for (const m of lines) {
      for (const n of m.values()) {
        maxLine = Math.max(maxLine, n);
        alignment += (n * (n - 1)) / 2;
      }
    }
    return { maxRay, maxLine, alignment, adjacent, over2: Math.max(0, near2 - 2) };
  }

  const RAY_STEPS = [[4, 8000], [6, 19000], [8, 33000], [10, 22000]];

  // Score « lignes »: on cherche à aligner les feux sur un rayon depuis le joueur pour les manger en série.
  function lineHealth(ctx, state, opts) {
    const m = mobility(ctx, state);
    const lf = lineFeatures(ctx, state);
    let value = opts.wEnemies * state.fires.length + opts.wPv * state.pv + opts.wMobility * m.open + opts.wKills * m.kills;
    value += opts.wRay * lf.maxRay;
    for (const [threshold, bonus] of RAY_STEPS) if (lf.maxRay >= threshold) value += bonus * opts.rayStepScale;
    value += opts.wLine * lf.maxLine + opts.wAlign * lf.alignment - opts.wOver2 * lf.over2 - opts.wAdjacent * lf.adjacent;
    return value;
  }

  function health(ctx, state, opts) {
    if (opts.mode === "lines") return lineHealth(ctx, state, opts);
    const m = mobility(ctx, state);
    let value = opts.pvWeight * state.pv + opts.killBonus * Math.min(4, m.kills) + opts.openWeight * Math.min(8, m.open);
    if (opts.adjPenalty || opts.nearBonus) {
      const sh = shape(state);
      value += opts.nearBonus * sh.near - opts.adjPenalty * sh.adj;
    }
    return value;
  }

  function search(ctx, start, options) {
    const opts = { ...config, ...(options || {}) };
    let beam = [{ state: start, path: [], score: 0 }];
    const seen = new Map();
    let best = null;
    for (let layer = 0; layer < opts.layers && beam.length; layer += 1) {
      if (opts.deadline && Date.now() > opts.deadline) return null;
      const next = new Map();
      for (const node of beam) {
        for (const action of E.actionsOf(node.state)) {
          const result = E.apply(ctx, node.state, action);
          if (!result) continue;
          const path = node.path.concat([action]);
          if (result.won) {
            if (!best || path.length < best.path.length) best = { state: result, path };
            continue;
          }
          const key = keyOf(result);
          const known = seen.get(key);
          if (known !== undefined && known >= result.pv) continue;
          seen.set(key, result.pv);
          const old = next.get(key);
          if (old && old.state.pv >= result.pv) continue;
          next.set(key, { state: result, path, score: 0 });
        }
      }
      if (best) return best;
      // Regroupement par nombre de feux restants; on évalue finement seulement les meilleurs candidats de chaque palier.
      const buckets = new Map();
      for (const e of next.values()) {
        const n = e.state.fires.length * 100 + Math.floor(e.state.pv / opts.pvTier);
        if (!buckets.has(n)) buckets.set(n, []);
        buckets.get(n).push(e);
      }
      if (opts.select === "global") {
        let pool = [...next.values()];
        const cap = opts.beam * opts.prefilter;
        if (pool.length > cap) {
          pool.sort((x, y) => x.state.fires.length - y.state.fires.length || y.state.pv - x.state.pv);
          pool = pool.slice(0, cap);
        }
        for (const e of pool) e.score = health(ctx, e.state, opts);
        pool.sort((x, y) => y.score - x.score);
        beam = pool.slice(0, opts.beam);
        if (options && options.onBeam) options.onBeam(layer, beam);
        if (options && options.onLayer) options.onLayer(layer, beam.length, beam[0] && beam[0].state.fires.length);
        continue;
      }
      // Quota par palier: le faisceau total reste borné sans sacrifier les paliers qui ont encore beaucoup de feux
      // (ceux-ci sont souvent les bons: ils n'ont pas encore dépensé de PV en vain).
      const quota = Math.max(opts.minQuota, Math.min(opts.perBucket, Math.floor(opts.beam / buckets.size)));
      beam = [];
      for (const list of buckets.values()) {
        let pool = list;
        const cap = quota * opts.prefilter;
        if (pool.length > cap) {
          pool.sort((x, y) => y.state.pv - x.state.pv);
          pool = pool.slice(0, cap);
        }
        for (const e of pool) e.score = health(ctx, e.state, opts);
        pool.sort((x, y) => y.score - x.score);
        for (const item of pool.slice(0, quota)) beam.push(item);
      }
      if (options && options.onBeam) options.onBeam(layer, beam);
      if (options && options.onLayer) options.onLayer(layer, beam.length, beam[0] && beam[0].state.fires.length);
    }
    return best;
  }

  // Recherche en profondeur avec mémoire des états déjà explorés: on tente d'abord les kills et les positions
  // qui laissent le plus de manœuvres, et on ne revisite pas un état sauf avec plus de PV.
  function dfs(ctx, start, options) {
    const opts = { budget: 400000, maxDepth: 400, ...(options || {}) };
    const visited = new Map();
    let expanded = 0;
    let found = null;
    const path = [];

    function visit(state, depth) {
      if (found || expanded > opts.budget || depth > opts.maxDepth) return;
      expanded += 1;
      const children = [];
      for (const action of E.actionsOf(state)) {
        // Finir un tour qu'on n'a pas commencé ne sert qu'à perdre un PV.
        if (action.kind === "end" && state.pa === E.PA_MAX && state.doubles === 0 && state.turn >= 6 && !(state.glyphs && state.glyphs.length)) continue;
        const result = E.apply(ctx, state, action);
        if (!result) continue;
        if (result.won) {
          found = { state: result, path: path.concat([action]) };
          return;
        }
        const key = keyOf(result);
        const seen = visited.get(key);
        if (seen !== undefined && seen >= result.pv) continue;
        children.push({ action, result, key, fires: result.fires.length });
      }
      for (const child of children) child.open = openActions(ctx, child.result) + killOptions(ctx, child.result) * 2;
      children.sort((a, b) => a.fires - b.fires || b.open - a.open || b.result.pv - a.result.pv);
      for (const child of children) {
        const seen = visited.get(child.key);
        if (seen !== undefined && seen >= child.result.pv) continue;
        visited.set(child.key, child.result.pv);
        path.push(child.action);
        visit(child.result, depth + 1);
        path.pop();
        if (found) return;
      }
    }

    visit(start, 0);
    if (options && options.stats) options.stats.expanded = expanded;
    return found;
  }

  // Plusieurs recherches de plus en plus larges, avec deux façons de classer les états; on s'arrête à la première victoire.
  const STAGES = {
    rapide: [
      { label: "lignes", beam: 1200, mode: "lines", select: "global" },
      { label: "paliers", beam: 1200, perBucket: 50, mode: "classic", select: "bucket" },
    ],
    normal: [
      { label: "lignes", beam: 1500, mode: "lines", select: "global" },
      { label: "paliers", beam: 1500, perBucket: 60, mode: "classic", select: "bucket" },
      { label: "lignes large", beam: 4000, mode: "lines", select: "global" },
      { label: "paliers large", beam: 3500, perBucket: 120, mode: "classic", select: "bucket" },
    ],
    approfondi: [
      { label: "lignes", beam: 1500, mode: "lines", select: "global" },
      { label: "paliers", beam: 1500, perBucket: 60, mode: "classic", select: "bucket" },
      { label: "lignes large", beam: 4000, mode: "lines", select: "global" },
      { label: "paliers large", beam: 3500, perBucket: 120, mode: "classic", select: "bucket" },
      { label: "lignes très large", beam: 9000, mode: "lines", select: "global" },
      { label: "paliers très large", beam: 8000, perBucket: 250, mode: "classic", select: "bucket" },
    ],
  };

  function solve(ctx, start, effort, onProgress, budgetMs) {
    const stages = STAGES[effort] || STAGES.normal;
    const deadline = Date.now() + (budgetMs || 120000);
    for (let i = 0; i < stages.length; i += 1) {
      const stage = stages[i];
      if (onProgress) onProgress({ stage: i + 1, stages: stages.length, label: stage.label, layer: 0, fires: start.fires.length });
      const res = search(ctx, start, {
        ...stage,
        prefilter: 3,
        deadline,
        onLayer: (layer, size, fires) => {
          if (onProgress && layer % 3 === 0) onProgress({ stage: i + 1, stages: stages.length, label: stage.label, layer, fires });
        },
      });
      if (res) return res;
      if (Date.now() > deadline) break;
    }
    return null;
  }

  const api = { solve, STAGES, config, search, dfs, killOptions, mobility, health, shape };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulBolgrotSearch = api;
  }
})(typeof self !== "undefined" ? self : this);
