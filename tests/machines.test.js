// Tests du solveur des petites machines (assets/js/machines/solver.js)
const test = require("node:test");
const assert = require("node:assert");
const S = require("../assets/js/machines/solver.js");
const def = require("../data/machines.json");

const flat = { map: { amin: 0, bmin: 0, rows: ["........", "........", "...o...."] }, center: [6, 0], glyphs: [[5, 0]] };

test("une machine frappée en ligne glisse jusqu'au corps à corps du joueur", () => {
  const game = S.makeGame(flat);
  assert.deepStrictEqual(S.pull(game, new Set(), [0, 0], [5, 0]), [4, 0]);
});

test("elle s'arrête avant un trou ou une autre machine", () => {
  const game = S.makeGame(flat);
  assert.deepStrictEqual(S.pull(game, new Set(), [0, 2], [6, 2]), [2, 2]);
  assert.deepStrictEqual(S.pull(game, new Set(["2,0"]), [0, 0], [5, 0]), [1, 0]);
});

test("la carte du guide se résout avec une portée de 6", () => {
  const game = S.makeGame(def);
  const result = S.solve(game, def, { range: 6 });
  assert.ok(result, "un plan est trouvé");
  const glyphs = new Set(def.glyphs.map((g) => g.join(",")));
  const end = new Map(def.machines.map((m) => [m.id, m.cell.join(",")]));
  result.plan.forEach((hit) => end.set(hit.id, hit.to.join(",")));
  assert.strictEqual(new Set(end.values()).size, 4);
  end.forEach((cell) => assert.ok(glyphs.has(cell), `machine sur ${cell}`));
});
