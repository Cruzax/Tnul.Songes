const test = require("node:test");
const assert = require("node:assert");
const S = require("../assets/js/minogolem/solver.js");
const def = require("../data/minogolem.json");

const NAMES = ["sang", "sel", "or"];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Un bloc de 4 annonces: a, b (différents), puis la 3e valeur, puis b
function randomBlock() {
  const a = pick(NAMES);
  const b = pick(NAMES.filter((n) => n !== a));
  const z = NAMES.find((n) => n !== a && n !== b);
  return [a, b, z, b];
}

function startState() {
  return { pos: def.start.slice(), hp: def.hp - 1, cdB: 0, cdC: 0, walls: new Set(), corners: { ...def.corners } };
}

function playFight(game) {
  let state = startState();
  let infos = randomBlock().concat(randomBlock());
  for (let round = 0; round < 40; round += 1) {
    const planned = S.plan(game, state, infos);
    if (!planned) return false;
    const { state: next } = S.play(game, state, planned, infos, 4);
    if (!next) return false;
    if (next.won) return true;
    state = next;
    infos = infos.slice(4).concat(randomBlock());
  }
  return false;
}

test("les règles d'un tour: échange du Séculaire puis mur opposé", () => {
  const game = S.makeGame(def);
  const state = startState();
  // Séculaire (O) échange avec Or (S): il passe au sud, le mur apparaît au nord du joueur
  const after = S.step(game, state, { reduce: 0, move: null }, "or");
  assert.strictEqual(after.corners.S, "seculaire");
  assert.ok(after.walls.has("18,19"));
  assert.strictEqual(after.hp, state.hp - 1);
});

test("un mur ne peut pas apparaître dans un mur fixe", () => {
  const game = S.makeGame(def);
  const state = startState();
  // Séculaire passe à l'est (Sang): le mur serait à l'ouest du joueur, en (19,18): libre
  const after = S.step(game, state, { reduce: 0, move: null }, "sang");
  assert.ok(after.walls.has("19,18"));
});

test("le solveur gagne la grande majorité des combats simulés", { timeout: 600000 }, () => {
  const game = S.makeGame(def);
  const runs = 30;
  let wins = 0;
  for (let i = 0; i < runs; i += 1) {
    if (playFight(game)) wins += 1;
  }
  console.log(`victoires: ${wins}/${runs}`);
  assert.ok(wins / runs >= 0.9, `taux de victoire trop bas: ${wins}/${runs}`);
});
