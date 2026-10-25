const test = require("node:test");
const assert = require("node:assert");
const R = require("../assets/js/rainikrone/engine.js");
const S = require("../assets/js/rainikrone/search.js");
const def = require("../data/rainikrone.json");

const geo = R.parse(def);
const at = (r, c) => r * geo.cols + c;
const emptyBoard = () => {
  const colors = new Array(geo.rows * geo.cols).fill(0);
  geo.pinks.forEach((p) => { colors[p] = R.PINK; });
  return colors;
};

test("le départ est au centre et il y a 4 objectifs roses", () => {
  assert.strictEqual(geo.start, at(5, 5));
  assert.strictEqual(geo.pinks.length, 4);
});

test("jaune: devient rouge et avance d'une case de plus", () => {
  const colors = emptyBoard();
  colors[at(4, 5)] = R.YELLOW; // au nord du départ
  const next = R.jump(geo, R.initial(geo, colors), "N");
  assert.strictEqual(next.pos, at(3, 5));
  assert.strictEqual(next.grid[at(4, 5)], R.RED);
});

test("rouge: devient vert et fait tourner les 4 voisins", () => {
  const colors = emptyBoard();
  colors[at(5, 6)] = R.RED;
  colors[at(4, 6)] = R.YELLOW;
  colors[at(6, 6)] = R.GREEN;
  colors[at(5, 7)] = R.BLACK;
  const next = R.jump(geo, R.initial(geo, colors), "E");
  assert.strictEqual(next.pos, at(5, 6));
  assert.strictEqual(next.grid[at(5, 6)], R.GREEN);
  assert.strictEqual(next.grid[at(4, 6)], R.RED);
  assert.strictEqual(next.grid[at(6, 6)], R.BLACK);
  assert.strictEqual(next.grid[at(5, 7)], R.YELLOW);
});

test("vert: devient jaune et ramène sur la case précédente", () => {
  const colors = emptyBoard();
  colors[at(5, 6)] = R.GREEN;
  const next = R.jump(geo, R.initial(geo, colors), "E");
  assert.strictEqual(next.pos, geo.start);
  assert.strictEqual(next.grid[at(5, 6)], R.YELLOW);
});

test("noir: devient rouge et ramène sur la dernière case vide visitée", () => {
  const colors = emptyBoard();
  colors[at(5, 6)] = R.BLACK;
  const next = R.jump(geo, R.initial(geo, colors), "E");
  assert.strictEqual(next.pos, geo.start);
  assert.strictEqual(next.grid[at(5, 6)], R.RED);
});

test("rose: la case se vide et l'objectif est compté", () => {
  const colors = emptyBoard();
  const start = R.initial(geo, colors, at(0, 1));
  const next = R.jump(geo, start, "W");
  assert.strictEqual(next.pos, at(0, 0));
  assert.strictEqual(next.pinks.length, 3);
  assert.strictEqual(next.grid[at(0, 0)], R.EMPTY);
});

test("on ne saute pas dans un mur ni hors de la carte", () => {
  const colors = emptyBoard();
  assert.strictEqual(R.jump(geo, R.initial(geo, colors, at(0, 4)), "E"), null);
  assert.strictEqual(R.jump(geo, R.initial(geo, colors, at(0, 1)), "N"), null);
});

test("le solveur trouve les bonds sur des grilles aléatoires", () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let game = 0; game < 4; game += 1) {
    const colors = emptyBoard();
    for (let i = 0; i < colors.length; i += 1) {
      if (!geo.walls[i] && i !== geo.start && colors[i] === 0) colors[i] = 1 + Math.floor(rnd() * 4);
    }
    const start = R.initial(geo, colors);
    const result = S.search(geo, start, { beam: 1500 });
    assert.ok(result, "aucune solution trouvée");
    // On rejoue le résultat sur le moteur
    let state = start;
    for (const dir of result.path) state = R.jump(geo, state, dir);
    assert.strictEqual(state.pinks.length, 0);
  }
});
