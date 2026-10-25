// Calcule le plan hors du fil principal pour garder la page fluide.
importScripts("solver.js");

self.onmessage = (event) => {
  const { id, def, options, state, infos } = event.data;
  const S = self.TnulMinogolem;
  const game = S.makeGame(def, options);
  const full = { ...state, walls: new Set(state.walls) };
  const planned = S.plan(game, full, infos);
  if (!planned) {
    self.postMessage({ id, plan: null });
    return;
  }
  const { states } = S.play(game, full, planned, infos, 4);
  self.postMessage({
    id,
    plan: {
      actions: planned.actions,
      won: Boolean(planned.won),
      states: states.map((s) => ({ ...s, walls: [...s.walls] })),
    },
  });
};
