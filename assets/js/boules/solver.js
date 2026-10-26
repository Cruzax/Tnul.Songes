// Solveur du combat des boules élémentaires (quête « Dans la gueule du dragon »).
// Règles (guide Dofus pour les Noobs): tu choisis une direction par tour (glyphe blanc autour de toi). Chaque coup
// sur une grosse boule fait avancer toutes les petites boules d'une case dans cette direction, et celle de la boule
// frappée de deux. Une petite boule arrivée sur une case de son glyphe ne bouge plus; si elle passe sur le glyphe
// d'une autre couleur, elle meurt et le combat est perdu. Une boule s'arrête contre un mur, le bord, le trou au
// centre d'un glyphe, une grosse boule, toi ou une autre petite boule.
// Script classique: expose BallSolver (navigateur) et module.exports (tests Node).
(function (root) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (c) => c[0] + "," + c[1];

  function makeGame(def) {
    const floor = new Set();
    def.map.rows.forEach((row, line) => {
      [...row].forEach((ch, column) => {
        if (ch === ".") floor.add(key([def.map.amin + column, def.map.bmin + line]));
      });
    });
    const glyphOf = new Map();
    const holes = new Set();
    def.balls.forEach((ball, i) => {
      holes.add(key(ball.cross));
      DIRS.forEach(([da, db]) => glyphOf.set(key([ball.cross[0] + da, ball.cross[1] + db]), i));
    });
    const fixed = new Set([key(def.player), ...def.balls.map((b) => key(b.big))]);
    return { floor, glyphOf, holes, fixed, balls: def.balls };
  }

  // Un coup: direction d, boule frappée i. Renvoie les nouvelles positions, ou null si une boule meurt.
  function strike(game, cells, locked, d, hit) {
    const next = cells.map((c) => c.slice());
    const done = locked.slice();
    const steps = cells.map((_, i) => (done[i] ? 0 : i === hit ? 2 : 1));
    // On avance case par case, en commençant par les boules les plus en avant dans la direction
    const order = cells.map((_, i) => i).sort((x, y) => (cells[y][0] * d[0] + cells[y][1] * d[1]) - (cells[x][0] * d[0] + cells[x][1] * d[1]));
    for (let round = 0; round < 2; round++) {
      for (const i of order) {
        if (steps[i] <= round || done[i]) continue;
        const to = [next[i][0] + d[0], next[i][1] + d[1]];
        const k = key(to);
        if (!game.floor.has(k) || game.holes.has(k) || game.fixed.has(k) || next.some((c, j) => j !== i && key(c) === k)) {
          steps[i] = round;
          continue;
        }
        next[i] = to;
        const glyph = game.glyphOf.get(k);
        if (glyph !== undefined && glyph !== i) return null;
        if (glyph === i) done[i] = true;
      }
    }
    return { cells: next, locked: done };
  }

  // Distance d'une boule à la case libre la plus proche de son glyphe (pour guider la recherche)
  function distance(game, cell, i) {
    const c = game.balls[i].cross;
    return Math.min(...DIRS.map(([da, db]) => Math.abs(cell[0] - c[0] - da) + Math.abs(cell[1] - c[1] - db)));
  }

  // Recherche en faisceau sur les coups; un changement de direction = un nouveau tour
  function solve(game, def, options) {
    const opts = { beam: 1500, maxSteps: 90, ...(options || {}) };
    const startCells = def.balls.map((b) => b.small.slice());
    const startLocked = startCells.map((c, i) => game.glyphOf.get(key(c)) === i);
    const score = (n) => n.locked.reduce((s, l, i) => s + (l ? 0 : distance(game, n.cells[i], i) * 3), 0) + n.turns * 0.5 + n.path.length * 0.2;
    let layer = [{ cells: startCells, locked: startLocked, dir: null, turns: 0, path: [] }];
    const seen = new Set();
    for (let step = 0; step < opts.maxSteps && layer.length; step++) {
      const next = [];
      for (const node of layer) {
        for (let di = 0; di < 4; di++) {
          for (let i = 0; i < game.balls.length; i++) {
            if (node.locked[i]) continue;
            const r = strike(game, node.cells, node.locked, DIRS[di], i);
            if (!r) continue;
            const k = r.cells.map(key).join(";") + "|" + r.locked.map(Number).join("");
            if (seen.has(k)) continue;
            seen.add(k);
            const n = { ...r, dir: di, turns: node.turns + (node.dir === di ? 0 : 1), path: node.path.concat([{ dir: DIRS[di], hit: i }]) };
            if (n.locked.every(Boolean)) return n;
            next.push(n);
          }
        }
      }
      next.sort((x, y) => score(x) - score(y));
      layer = next.slice(0, opts.beam);
    }
    return null;
  }

  const api = { makeGame, strike, solve };
  root.BallSolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
