// Tests du solveur des Souffles du Reflet (assets/js/souffles/solver.js)
const test = require("node:test");
const assert = require("node:assert");
const S = require("../assets/js/souffles/solver.js");
const def = require("../data/souffles.json");

// Petite carte de test: une ligne de sol, le joueur à gauche
const line = (souffles) => ({ map: { amin: 0, bmin: 0, rows: [".........", "........."] }, player: [0, 0], hp: 50, pa: 10, pm: 1, souffles });
const colors = (s) => s.souffles.map((x) => x.color).join("");

test("Vibration: un noir est repoussé, un blanc attiré, et la cible change de couleur", () => {
  const game = S.makeGame(line([]));
  const black = S.apply(game, S.initialState(line([{ id: 1, cell: [3, 0], color: "n" }])), { type: "vib", index: 0 });
  assert.deepStrictEqual(black.souffles[0].cell, [4, 0]);
  assert.strictEqual(black.souffles[0].color, "b");
  const white = S.apply(game, S.initialState(line([{ id: 1, cell: [3, 0], color: "b" }])), { type: "vib", index: 0 });
  assert.deepStrictEqual(white.souffles[0].cell, [2, 0]);
  assert.strictEqual(white.souffles[0].color, "n");
  assert.strictEqual(white.hp, 49);
});

test("les Souffles alignés avec la case d'arrivée changent aussi de couleur", () => {
  const def2 = line([{ id: 1, cell: [3, 0], color: "n" }, { id: 2, cell: [4, 1], color: "n" }, { id: 3, cell: [6, 1], color: "b" }]);
  const s = S.apply(S.makeGame(def2), S.initialState(def2), { type: "vib", index: 0 });
  // arrivée (4,0): le 2 est dans la même colonne, le 3 ni ligne ni colonne
  assert.strictEqual(colors(s), "bbb");
});

test("Réciprocité échange les places et coûte 3 PV", () => {
  const def2 = line([{ id: 1, cell: [3, 0], color: "b" }]);
  const s = S.apply(S.makeGame(def2), S.initialState(def2), { type: "recip", index: 0 });
  assert.deepStrictEqual(s.player, [3, 0]);
  assert.deepStrictEqual(s.souffles[0].cell, [0, 0]);
  assert.strictEqual(s.hp, 47);
  assert.ok(!S.actions(S.makeGame(def2), s).some((a) => a.type === "recip"), "une seule Réciprocité par tour");
});

test("la carte du guide se résout avec des PV de reste", () => {
  for (const firstOnly of [false, true]) {
    const result = S.solve(S.makeGame(def, { firstOnly }), S.initialState(def));
    assert.ok(result, "un plan est trouvé");
    assert.ok(result.hp >= 10, `PV restants: ${result.hp}`);
    assert.strictEqual(S.wrong(result.end, result.color), 0);
  }
});
