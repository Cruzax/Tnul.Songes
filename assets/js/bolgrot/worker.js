// Cherche le plan hors du fil principal, en donnant des nouvelles de la progression.
importScripts("engine.js", "search.js");

self.onmessage = (event) => {
  const { def, state, effort, budgetMs } = event.data;
  const ctx = self.TnulBolgrotEngine.makeCtx(def);
  const result = self.TnulBolgrotSearch.solve(
    ctx,
    state,
    effort,
    (progress) => self.postMessage({ type: "progress", ...progress }),
    budgetMs
  );
  self.postMessage({ type: "done", path: result ? result.path : null });
};
