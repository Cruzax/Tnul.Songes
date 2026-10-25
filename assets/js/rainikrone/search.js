// Recherche en faisceau d'une suite de bonds qui active les 4 objectifs roses.
(function (root) {
  const R = root.TnulRainikroneEngine || require("./engine.js");

  const config = { beam: 3000, maxJumps: 160 };

  function distanceMap(geo, targets) {
    // Distance à pied (sans tenir compte des couleurs) jusqu'à l'objectif le plus proche.
    const dist = new Int16Array(geo.rows * geo.cols).fill(-1);
    const queue = [];
    for (const t of targets) {
      dist[t] = 0;
      queue.push(t);
    }
    for (let head = 0; head < queue.length; head += 1) {
      const i = queue[head];
      const r = (i / geo.cols) | 0;
      const c = i % geo.cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= geo.rows || nc < 0 || nc >= geo.cols) continue;
        const n = nr * geo.cols + nc;
        if (geo.walls[n] || dist[n] >= 0) continue;
        dist[n] = dist[i] + 1;
        queue.push(n);
      }
    }
    return dist;
  }

  const keyOf = (s) => s.pos + "|" + s.traj.slice(-8).join(",") + "|" + s.pinks.length + "|" + gridKey(s.grid);
  function gridKey(grid) {
    // Chaîne compacte de la grille (une lettre par case).
    let out = "";
    for (let i = 0; i < grid.length; i += 1) out += grid[i];
    return out;
  }

  function search(geo, start, options) {
    const opts = { ...config, ...(options || {}) };
    const distCache = new Map();
    const distFor = (pinks) => {
      const k = pinks.join(",");
      if (!distCache.has(k)) distCache.set(k, distanceMap(geo, pinks));
      return distCache.get(k);
    };
    const score = (s) => {
      if (!s.pinks.length) return 1e9;
      const d = distFor(s.pinks)[s.pos];
      // Moins d'objectifs restants d'abord, puis la proximité de l'objectif le plus proche.
      return -s.pinks.length * 100 - d * 4;
    };
    let beam = [{ s: start, path: [] }];
    const seen = new Set([keyOf(start)]);
    for (let depth = 0; depth < opts.maxJumps && beam.length; depth += 1) {
      if (opts.deadline && Date.now() > opts.deadline) return null;
      const next = [];
      for (const node of beam) {
        for (const dir of R.DIR_KEYS) {
          const result = R.jump(geo, node.s, dir);
          if (!result) continue;
          const path = node.path.concat([dir]);
          if (!result.pinks.length) return { path, state: result };
          const key = keyOf(result);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ s: result, path, score: score(result) });
        }
      }
      next.sort((a, b) => b.score - a.score);
      beam = next.slice(0, opts.beam);
      if (options && options.onLayer) options.onLayer(depth, beam.length, beam[0] ? beam[0].s.pinks.length : 0);
    }
    return null;
  }

  const api = { search, config };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulRainikroneSearch = api;
  }
})(typeof self !== "undefined" ? self : this);
