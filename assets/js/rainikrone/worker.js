// Cherche la suite de bonds hors du fil principal, avec des recherches de plus en plus larges.
importScripts("engine.js", "search.js");

self.onmessage = (event) => {
  const { def, colors, start: startPos } = event.data;
  const R = self.TnulRainikroneEngine;
  const geo = R.parse(def);
  const start = R.initial(geo, colors, startPos);
  const deadline = Date.now() + 60000;
  for (const beam of [1500, 4000, 10000]) {
    self.postMessage({ type: "progress", beam });
    const result = self.TnulRainikroneSearch.search(geo, start, { beam, deadline });
    if (result) {
      self.postMessage({ type: "done", path: result.path });
      return;
    }
    if (Date.now() > deadline) break;
  }
  self.postMessage({ type: "done", path: null });
};
