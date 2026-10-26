// Lecture d'une capture du combat des petites machines (calage par assets/js/lib/capture-grid.js).
// Le sol est de l'herbe verte: au-dessus d'une case, une machine se voit par ses pixels de métal et de bois
// (peu saturés ou bruns), à la base de la case. On garde les cases les plus marquées, en évitant les voisines.
(function (root) {
  const ABOVE = { x0: -0.18, x1: 0.18, y0: -0.5, y1: 0 };
  const grass = (p) => p.hue > 55 && p.hue < 110 && p.sat > 0.28 && p.light > 0.18;
  function read(sample, def, count, player) {
    const scores = [];
    def.map.rows.forEach((row, line) => {
      [...row].forEach((ch, column) => {
        if (ch !== ".") return;
        const a = def.map.amin + column;
        const b = def.map.bmin + line;
        // Ni la grosse machine et ses glyphes, ni toi: leurs dessins débordent sur les cases autour
        if (Math.abs(a - def.center[0]) + Math.abs(b - def.center[1]) <= 2) return;
        if (player && Math.abs(a - player[0]) <= 1 && Math.abs(b - player[1]) <= 1) return;
        const px = sample.region(a, b, ABOVE);
        const metal = CaptureGrid.share(px, (p) => !grass(p) && p.light > 0.12 && p.light < 0.8);
        scores.push({ cell: [a, b], metal });
      });
    });
    scores.sort((x, y) => y.metal - x.metal);
    const found = [];
    const near = (p, q) => Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1;
    for (const s of scores) {
      if (found.length >= count || s.metal < 0.35) break;
      if (found.some((f) => near(f.cell, s.cell))) continue;
      found.push(s);
    }
    return found.map((f) => f.cell);
  }
  root.MachineCapture = { read };
})(typeof self !== "undefined" ? self : this);
