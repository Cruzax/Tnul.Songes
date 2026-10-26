// Tests du solveur des boules élémentaires (assets/js/boules/solver.js)
const test = require("node:test");
const assert = require("node:assert");
const S = require("../assets/js/boules/solver.js");
const def = require("../data/boules.json");

const tiny = (balls) => ({ map: { amin: 0, bmin: 0, rows: ["..........", ".........."] }, player: [0, 1], balls });

test("toutes les petites boules avancent d'une case, celle de la boule frappée de deux", () => {
  const d = tiny([{ color: "a", cross: [9, 1], small: [1, 0], big: [0, 0] }, { color: "b", cross: [9, 0], small: [4, 0], big: [3, 1] }]);
  const r = S.strike(S.makeGame(d), [[1, 0], [4, 0]], [false, false], [1, 0], 0);
  assert.deepStrictEqual(r.cells, [[3, 0], [5, 0]]);
});

test("une boule qui passe sur le glyphe d'une autre couleur meurt", () => {
  const d = tiny([{ color: "a", cross: [6, 1], small: [4, 0], big: [0, 0] }, { color: "b", cross: [1, 1], small: [8, 1], big: [3, 1] }]);
  assert.strictEqual(S.strike(S.makeGame(d), [[4, 0], [8, 1]], [false, false], [1, 0], 1), null);
});

test("l'exemple se résout", () => {
  const r = S.solve(S.makeGame(def), def);
  assert.ok(r && r.locked.every(Boolean));
});
