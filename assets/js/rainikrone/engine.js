// Moteur du combat « Rainikrone » (Dofus Ivoire): bonds d'une case sur des glyphes de couleur.
// Règles (guide): Jaune → devient Rouge et téléporte d'une case dans le sens du bond; Rouge → devient Vert et fait tourner
// la couleur des 4 voisins (Jaune → Rouge → Vert → Noir → Jaune); Vert → devient Jaune et ramène sur la case précédente;
// Noir → devient Rouge et ramène sur la dernière case vide visitée; Rose → objectif, la case se vide.
(function (root) {
  const EMPTY = 0;
  const YELLOW = 1;
  const RED = 2;
  const GREEN = 3;
  const BLACK = 4;
  const PINK = 5;
  const NAMES = ["empty", "yellow", "red", "green", "black", "pink"];
  const DIRS = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };
  const DIR_KEYS = ["N", "S", "W", "E"];

  // Carte: tableau de chaînes; '#' mur, 'G' objectif rose, 'P' départ, '.' glyphe à renseigner.
  function parse(def) {
    const rows = def.grid.length;
    const cols = def.grid[0].length;
    const walls = new Uint8Array(rows * cols);
    const grid = new Uint8Array(rows * cols);
    let start = -1;
    const pinks = [];
    def.grid.forEach((line, r) => {
      for (let c = 0; c < cols; c += 1) {
        const ch = line[c];
        const i = r * cols + c;
        if (ch === "#") walls[i] = 1;
        else if (ch === "P") start = i;
        else if (ch === "G") {
          grid[i] = PINK;
          pinks.push(i);
        }
      }
    });
    return { rows, cols, walls, start, pinks };
  }

  // Résolution en chaîne après un bond: modifie `grid` et `traj` en place; renvoie l'index rose consommé, ou -1.
  function resolve(geo, grid, traj, dr, dc) {
    const { rows, cols, walls } = geo;
    const seen = new Set();
    for (;;) {
      const idx = traj[traj.length - 1];
      const color = grid[idx];
      if (color === EMPTY) return -1;
      const key = idx * 8 + color;
      if (seen.has(key)) return -1;
      seen.add(key);
      const r = (idx / cols) | 0;
      const c = idx - r * cols;
      if (color === YELLOW) {
        grid[idx] = RED;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || walls[nr * cols + nc]) return -1;
        traj.push(nr * cols + nc);
      } else if (color === GREEN) {
        grid[idx] = YELLOW;
        if (traj.length < 2) return -1;
        traj.pop();
        const prev = traj[traj.length - 1];
        const pr = (prev / cols) | 0;
        dr = pr - r;
        dc = prev - pr * cols - c;
      } else if (color === RED) {
        grid[idx] = GREEN;
        const around = [];
        if (r > 0) around.push(idx - cols);
        if (r + 1 < rows) around.push(idx + cols);
        if (c + 1 < cols) around.push(idx + 1);
        if (c > 0) around.push(idx - 1);
        for (const a of around) {
          if (walls[a]) continue;
          const v = grid[a];
          if (v >= YELLOW && v <= BLACK) grid[a] = v < BLACK ? v + 1 : YELLOW;
        }
        return -1;
      } else if (color === BLACK) {
        grid[idx] = RED;
        for (let i = traj.length - 2; i >= 0; i -= 1) {
          if (grid[traj[i]] === EMPTY) {
            traj.push(traj[i]);
            break;
          }
        }
        return -1;
      } else {
        grid[idx] = EMPTY;
        return idx;
      }
    }
  }

  // state = { pos, grid:Uint8Array, traj:number[], pinks:number[] }
  function jump(geo, state, dir) {
    const [dr, dc] = DIRS[dir];
    const r = ((state.pos / geo.cols) | 0) + dr;
    const c = (state.pos % geo.cols) + dc;
    if (r < 0 || r >= geo.rows || c < 0 || c >= geo.cols) return null;
    const target = r * geo.cols + c;
    if (geo.walls[target]) return null;
    const traj = state.traj.concat([target]);
    let grid = state.grid;
    let pinks = state.pinks;
    if (grid[target] !== EMPTY) {
      grid = grid.slice();
      const removed = resolve(geo, grid, traj, dr, dc);
      if (removed !== -1) pinks = pinks.filter((p) => p !== removed);
    }
    return { pos: traj[traj.length - 1], grid, traj, pinks };
  }

  // pos: case de départ (par défaut le centre). Si on repart d'ailleurs, le centre sert de repli pour les glyphes noirs.
  function initial(geo, colors, pos) {
    const grid = new Uint8Array(geo.rows * geo.cols);
    for (let i = 0; i < grid.length; i += 1) grid[i] = colors[i] || 0;
    const at = pos === undefined ? geo.start : pos;
    return { pos: at, grid, traj: at === geo.start ? [at] : [geo.start, at], pinks: geo.pinks.filter((p) => grid[p] === PINK) };
  }

  const api = { EMPTY, YELLOW, RED, GREEN, BLACK, PINK, NAMES, DIRS, DIR_KEYS, parse, jump, initial };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulRainikroneEngine = api;
  }
})(typeof self !== "undefined" ? self : this);
