// Lecture d'une capture du combat des Souffles (calage par assets/js/lib/capture-grid.js).
// Sur chaque case de sol, on regarde la tête de la statue, juste au-dessus de la case: une blanche a beaucoup de
// pixels très clairs, une noire beaucoup de pixels très sombres (seuils réglés sur la capture du guide).
// Au bord du haut, le fond noir derrière la carte se confond avec une statue noire: ces cases sont rendues comme
// « à vérifier » et la page y garde ce qui était déjà placé.
(function (root) {
  const HEAD = { x0: -0.14, x1: 0.14, y0: -1.2, y1: -0.65 };
  const SKY = { x0: -0.16, x1: 0.16, y0: -1.6, y1: -1.25 };
  function read(sample, def) {
    const cells = [];
    def.map.rows.forEach((row, line) => {
      [...row].forEach((ch, column) => {
        if (ch !== ".") return;
        const a = def.map.amin + column;
        const b = def.map.bmin + line;
        const head = sample.region(a, b, HEAD);
        cells.push({
          cell: [a, b],
          bright: CaptureGrid.share(head, (p) => p.light > 0.84),
          dark: CaptureGrid.share(head, (p) => p.light < 0.22),
          sky: CaptureGrid.share(sample.region(a, b, SKY), (p) => p.light < 0.22),
        });
      });
    });
    const at = new Map(cells.map((c) => [c.cell.join(","), c]));
    const souffles = [];
    const unsure = [];
    cells.forEach((c) => {
      const [a, b] = c.cell;
      if (c.bright > 0.15) {
        souffles.push({ cell: c.cell, color: "b" });
        return;
      }
      if (c.sky > 0.5) {
        if (c.dark > 0.24) unsure.push(c.cell);
        return;
      }
      // Une statue noire déborde sur les cases voisines: on garde la plus sombre du coin
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([da, db]) => at.get(`${a + da},${b + db}`)).filter(Boolean);
      if (c.dark > 0.24 && neighbours.every((n) => n.dark <= c.dark || n.sky > 0.5)) souffles.push({ cell: c.cell, color: "n" });
    });
    return { souffles: souffles.map((s, i) => ({ id: i + 1, ...s })), unsure };
  }
  root.SouffleCapture = { read };
})(typeof self !== "undefined" ? self : this);
