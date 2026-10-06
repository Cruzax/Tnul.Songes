const test = require("node:test");
const assert = require("node:assert");
const G = require("../assets/js/grid.js");

const C = { u: 17, v: -3 };
const key = (c) => `${c.u},${c.v}`;
const keys = (cells) => cells.map(key).sort();

test("la grille a 560 cases valides et uniques", () => {
  const cells = G.allCells();
  assert.strictEqual(cells.length, 560);
  assert.strictEqual(new Set(cells.map(key)).size, 560);
  assert.ok(cells.every((c) => G.isValid(c.u, c.v)));
});

test("isValid refuse les cases hors grille", () => {
  assert.strictEqual(G.isValid(C.u, C.v), true);
  assert.strictEqual(G.isValid(-5, 0), false);
  assert.strictEqual(G.isValid(100, 100), false);
});

test("distance de Manhattan", () => {
  assert.strictEqual(G.distance({ u: 0, v: 0 }, { u: 2, v: -3 }), 5);
});

test("portée 1-1 sans contrainte = 4 voisins", () => {
  const cells = G.rangeCells(C, { poMin: 1, poMax: 1, line: false, diagonal: false });
  assert.strictEqual(cells.length, 4);
});

test("portée 2-3 en ligne = cases alignées uniquement", () => {
  const cells = G.rangeCells(C, { poMin: 2, poMax: 3, line: true, diagonal: false });
  assert.strictEqual(cells.length, 8);
  assert.ok(cells.every((c) => c.u === C.u || c.v === C.v));
});

test("portée en diagonale = |du| == |dv|", () => {
  const cells = G.rangeCells(C, { poMin: 2, poMax: 4, line: false, diagonal: true });
  assert.ok(cells.length > 0);
  assert.ok(cells.every((c) => Math.abs(c.u - C.u) === Math.abs(c.v - C.v)));
});

test("zone cercle de taille 2 = 13 cases", () => {
  const z = G.zoneCells(C, { u: C.u - 3, v: C.v }, { shape: "circle", size1: 2, size2: 0 });
  assert.strictEqual(z.length, 13);
});

test("zone cercle avec rayon intérieur 1 exclut le centre", () => {
  const z = G.zoneCells(C, C, { shape: "circle", size1: 2, size2: 1 });
  assert.strictEqual(z.length, 12);
  assert.ok(!keys(z).includes(key(C)));
});

test("zone croix de taille 1 = 5 cases", () => {
  const z = G.zoneCells(C, C, { shape: "cross", size1: 1, size2: 0 });
  assert.strictEqual(z.length, 5);
});

test("zone croix diagonale de taille 1 = 5 cases", () => {
  const z = G.zoneCells(C, C, { shape: "diagonalCross", size1: 1, size2: 0 });
  assert.strictEqual(z.length, 5);
});

test("zone ligne de taille 3 part de la cible, dans la direction du lanceur vers la cible", () => {
  const caster = { u: C.u - 4, v: C.v };
  const z = G.zoneCells(C, caster, { shape: "line", size1: 3, size2: 0 });
  assert.deepStrictEqual(keys(z), keys([0, 1, 2, 3].map((k) => ({ u: C.u + k, v: C.v }))));
});

test("zone ligne perpendiculaire de taille 1 = 3 cases", () => {
  const caster = { u: C.u - 4, v: C.v };
  const z = G.zoneCells(C, caster, { shape: "perpendicular", size1: 1, size2: 0 });
  assert.deepStrictEqual(keys(z), keys([-1, 0, 1].map((k) => ({ u: C.u, v: C.v + k }))));
});

test("zone cône de taille 2 = 9 cases", () => {
  const caster = { u: C.u - 4, v: C.v };
  const z = G.zoneCells(C, caster, { shape: "cone", size1: 2, size2: 0 });
  assert.strictEqual(z.length, 9);
});

test("zone carré de taille 1 = 9 cases", () => {
  const z = G.zoneCells(C, C, { shape: "square", size1: 1, size2: 0 });
  assert.strictEqual(z.length, 9);
});

test("zone 'all' = toute la carte", () => {
  const z = G.zoneCells(C, C, { shape: "all", size1: 0, size2: 0 });
  assert.strictEqual(z.length, 560);
});

test("une zone ne sort jamais de la grille", () => {
  const corner = G.allCells()[0];
  const z = G.zoneCells(corner, corner, { shape: "circle", size1: 3, size2: 0 });
  assert.ok(z.every((c) => G.isValid(c.u, c.v)));
});

test("fromScreen retrouve la case dessinée", () => {
  const s = G.toScreen(C.u, C.v);
  assert.deepStrictEqual(G.fromScreen(s.px, s.py), C);
});

// ---- ligne de vue ----
const wall = (u, v) => new Set([`${u},${v}`]);

test("un mur sur la ligne bloque la vue", () => {
  const a = { u: 17, v: -3 };
  const b = { u: 21, v: -3 };
  assert.strictEqual(G.hasLineOfSight(a, b, wall(19, -3)), false);
  assert.strictEqual(G.hasLineOfSight(a, b, new Set()), true);
  assert.strictEqual(G.hasLineOfSight(a, b, wall(19, -2)), true);
});

test("une case adjacente est toujours visible", () => {
  assert.strictEqual(G.hasLineOfSight({ u: 17, v: -3 }, { u: 18, v: -3 }, wall(18, -3)), true);
});

test("rangeCells avec LDV exclut le mur et ce qui est derrière", () => {
  const spell = { poMin: 1, poMax: 4, line: true, diagonal: false, los: true };
  const cells = G.rangeCells(C, spell, wall(19, -3)).map(key);
  assert.ok(cells.includes("18,-3"));
  assert.ok(!cells.includes("19,-3"));
  assert.ok(!cells.includes("20,-3"));
  assert.ok(!cells.includes("21,-3"));
});

test("rangeCells sans LDV requise: seul le mur lui-même est exclu", () => {
  const spell = { poMin: 1, poMax: 4, line: true, diagonal: false, los: false };
  const cells = G.rangeCells(C, spell, wall(19, -3)).map(key);
  assert.ok(!cells.includes("19,-3"));
  assert.ok(cells.includes("20,-3"));
});

test("visibleKeys: derrière un mur = non visible", () => {
  const seen = G.visibleKeys(C, wall(19, -3));
  assert.ok(seen.has("18,-3"));
  assert.ok(seen.has("19,-3"));
  assert.ok(!seen.has("20,-3"));
});
