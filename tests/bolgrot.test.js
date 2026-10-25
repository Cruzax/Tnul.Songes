const test = require("node:test");
const assert = require("node:assert");
const E = require("../assets/js/bolgrot/engine.js");
const S = require("../assets/js/bolgrot/search.js");
const def = require("../data/bolgrot.json");

const ctx = E.makeCtx(def);
const cell = (x, y) => y * E.W + x;
const base = (extra) => ({ p: cell(15, 15), fires: [], pv: 39, pa: 10, doubles: 0, turn: 7, ...extra });

test("la carte a des murs au bord et Bolgrot est un obstacle", () => {
  assert.ok(ctx.blocked[cell(0, 0)]);
  assert.ok(ctx.blocked[cell(20, 10)]);
  assert.ok(!ctx.blocked[cell(15, 15)]);
});

test("un bond sur un feu le tue, rend 1 PV et attire les autres feux", () => {
  const state = base({ fires: [cell(16, 15), cell(20, 15)] });
  const next = E.apply(ctx, state, { kind: "astral", dx: 1, dy: 0 });
  assert.strictEqual(next.p, cell(16, 15));
  assert.strictEqual(next.fires.length, 1);
  assert.strictEqual(next.pv, 39); // -1 pour le bond, +1 pour le feu tué
  assert.strictEqual(next.fires[0], cell(19, 15)); // le feu lointain s'est rapproché d'une case
});

test("atterrir à côté d'un feu sans le tuer est mortel, donc refusé", () => {
  const state = base({ fires: [cell(17, 15)] });
  assert.strictEqual(E.apply(ctx, state, { kind: "astral", dx: 1, dy: 0 }), null);
});

test("une répulsion bloquée contre un autre feu tue le joueur, donc refusée", () => {
  // Tuer le feu en (16,15) repousse (16,16) vers (16,17), déjà occupé par un feu stationnaire
  const state = base({ fires: [cell(16, 15), cell(16, 16), cell(16, 17)] });
  const why = {};
  assert.strictEqual(E.apply(ctx, state, { kind: "astral", dx: 1, dy: 0 }, why), null);
  assert.strictEqual(why.reason, "répulsion bloquée");
});

test("Immobilisme coûte 5 PV et attire les feux sans bouger le joueur", () => {
  const state = base({ fires: [cell(20, 20)] });
  const next = E.apply(ctx, state, { kind: "immo", dx: 1, dy: 1 });
  assert.strictEqual(next.p, state.p);
  assert.strictEqual(next.pv, 34);
  assert.notStrictEqual(next.fires[0], cell(20, 20));
});

test("fin de tour: -1 PV et les PA reviennent", () => {
  const next = E.apply(ctx, base({ pa: 3, fires: [cell(25, 20)] }), { kind: "end" });
  assert.strictEqual(next.pv, 38);
  assert.strictEqual(next.pa, 10);
});

test("au tour 6, les glyphes violets deviennent des feux à la fin du tour", () => {
  const state = base({ turn: 6, fires: [cell(25, 20)], glyphs: [cell(10, 10), cell(15, 15)] });
  const next = E.apply(ctx, state, { kind: "end" });
  assert.ok(next.fires.includes(cell(10, 10)));
  assert.ok(!next.fires.includes(cell(15, 15))); // le joueur est dessus: pas de feu
});

test("la recherche trouve un plan simple et il se rejoue jusqu'à la victoire", () => {
  const start = base({ fires: [cell(10, 10), cell(20, 20), cell(10, 20), cell(20, 12)] });
  const result = S.search(ctx, start, { beam: 200, perBucket: 20, prefilter: 3, mode: "classic", select: "bucket" });
  assert.ok(result, "aucun plan");
  let state = start;
  for (const action of result.path) {
    state = E.apply(ctx, state, action);
    assert.ok(state, "action impossible dans le plan");
  }
  assert.ok(state.won);
});
