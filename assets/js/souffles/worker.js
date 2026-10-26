// Calcul des coups dans un worker, pour ne pas figer la page pendant la recherche.
importScripts("solver.js");
self.onmessage = (event) => {
  const { def, firstOnly } = event.data;
  const game = SouffleSolver.makeGame(def, { firstOnly });
  const result = SouffleSolver.solve(game, SouffleSolver.initialState(def));
  self.postMessage(result);
};
