// Lecture d'une capture du combat des boules élémentaires (calage par assets/js/lib/capture-grid.js).
// Les boules sont repérées par leur couleur au-dessus de chaque case, près de toi: pour chaque couleur, la case
// la plus marquée est la grosse boule (plus grande), la petite est la plus marquée de ses 4 voisines.
(function (root) {
  const ABOVE = { x0: -0.25, x1: 0.25, y0: -0.75, y1: -0.05 };
  // Couleur de chaque boule à l'écran (teinte en degrés, saturation et luminosité de 0 à 1)
  const MATCH = {
    jaune: (p) => p.hue > 45 && p.hue < 62 && p.sat > 0.5 && p.light > 0.45,
    vert: (p) => p.hue > 68 && p.hue < 110 && p.sat > 0.4 && p.light > 0.35,
    blanc: (p) => p.light > 0.86 && p.sat < 0.25,
    orange: (p) => p.hue > 8 && p.hue < 32 && p.sat > 0.6 && p.light > 0.45 && p.light < 0.75,
    marron: (p) => p.hue > 10 && p.hue < 38 && p.sat > 0.25 && p.sat < 0.65 && p.light > 0.22 && p.light < 0.45,
    cyan: (p) => p.hue > 170 && p.hue < 205 && p.sat > 0.4 && p.light > 0.4,
  };
  function read(sample, def, radius) {
    const near = [];
    for (let a = def.player[0] - radius; a <= def.player[0] + radius; a++) {
      for (let b = def.player[1] - radius; b <= def.player[1] + radius; b++) {
        if (a === def.player[0] && b === def.player[1]) continue;
        const row = def.map.rows[b - def.map.bmin];
        if (!row || row[a - def.map.amin] !== ".") continue;
        near.push({ cell: [a, b], px: sample.region(a, b, ABOVE) });
      }
    }
    const taken = new Set();
    return def.balls.map((ball) => {
      const test = MATCH[ball.color];
      if (!test) return null;
      const ranked = near.map((n) => ({ cell: n.cell, score: CaptureGrid.share(n.px, test) }))
        .filter((n) => n.score > 0.03 && !taken.has(n.cell.join(",")))
        .sort((x, y) => y.score - x.score);
      if (!ranked.length) return null;
      const big = ranked[0].cell;
      taken.add(big.join(","));
      // La petite boule est posée à côté de sa grosse: on cherche d'abord parmi ses 4 voisines
      const side = ranked.find((n) => !taken.has(n.cell.join(",")) && Math.abs(n.cell[0] - big[0]) + Math.abs(n.cell[1] - big[1]) === 1)
        || ranked.find((n) => !taken.has(n.cell.join(",")));
      if (!side) return null;
      taken.add(side.cell.join(","));
      return { big, small: side.cell };
    });
  }
  root.BallCapture = { read, MATCH };
})(typeof self !== "undefined" ? self : this);
