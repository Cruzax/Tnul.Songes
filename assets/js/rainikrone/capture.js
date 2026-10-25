// Lecture d'une capture d'écran du combat de la Rainikrone: les 4 glyphes roses des coins donnent la géométrie de la grille,
// puis la couleur de chaque case est reconnue par sa teinte (valeurs moyennes mesurées sur des captures du jeu).
(function (root) {
  const YELLOW = 1;
  const RED = 2;
  const GREEN = 3;
  const BLACK = 4;
  const PINK = 5;
  // Teinte (degrés), saturation et luminosité moyennes d'une case de chaque couleur, avec l'écart toléré.
  const CENTROIDS = {
    [YELLOW]: { hue: 49.4, sat: 57, light: 63.1, hs: 7, ss: 9, ls: 5 },
    [RED]: { hue: 24.4, sat: 57, light: 62.4, hs: 6, ss: 9, ls: 5 },
    [GREEN]: { hue: 70, sat: 34.8, light: 58, hs: 14, ss: 8, ls: 5 },
    [BLACK]: { hue: 39.5, sat: 26, light: 52.4, hs: 12, ss: 9, ls: 4 },
  };

  const make = ({ data, width, height }) => ({
    width,
    height,
    at(x, y) {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= width || yi >= height) return null;
      const i = (yi * width + xi) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    },
  });

  function toHsl([r8, g8, b8]) {
    const r = r8 / 255;
    const g = g8 / 255;
    const b = b8 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    let hue = 0;
    let sat = 0;
    if (max !== min) {
      const d = max - min;
      sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    return { hue, sat: sat * 100, light: light * 100 };
  }

  const isPink = ([r, g, b]) => r > 170 && b > 110 && r - g > 70 && b - g > 25 && Math.abs(r - b) < 110;

  function components(img, mask, step) {
    const { width, height } = img;
    const seen = new Uint8Array(width * height);
    const out = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (seen[i]) continue;
        const px = img.at(x, y);
        if (!px || !mask(px)) continue;
        const stack = [[x, y]];
        seen[i] = 1;
        let n = 0;
        let sx = 0;
        let sy = 0;
        let minx = x;
        let maxx = x;
        let miny = y;
        let maxy = y;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          n += 1;
          sx += cx;
          sy += cy;
          if (cx < minx) minx = cx;
          if (cx > maxx) maxx = cx;
          if (cy < miny) miny = cy;
          if (cy > maxy) maxy = cy;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = ny * width + nx;
            if (seen[j]) continue;
            const q = img.at(nx, ny);
            if (q && mask(q)) {
              seen[j] = 1;
              stack.push([nx, ny]);
            }
          }
        }
        out.push({ n, x: sx / n, y: sy / n, w: maxx - minx, h: maxy - miny });
      }
    }
    return out;
  }

  function classify(hsl) {
    const scored = Object.entries(CENTROIDS).map(([color, c]) => {
      let dh = Math.abs(hsl.hue - c.hue);
      if (dh > 180) dh = 360 - dh;
      const d = Math.sqrt((dh / c.hs) ** 2 + ((hsl.sat - c.sat) / c.ss) ** 2 + ((hsl.light - c.light) / c.ls) ** 2);
      return { color: Number(color), d };
    }).sort((a, b) => a.d - b.d);
    return { color: scored[0].color, margin: scored[1].d - scored[0].d, d: scored[0].d };
  }

  // def: données de la carte (grille). Renvoie { ok, colors (tableau d'index → couleur), uncertain (index douteux) }.
  function analyze(pixels, def) {
    const img = make(pixels);
    const rows = def.grid.length;
    const cols = def.grid[0].length;

    // 1. Les 4 glyphes roses des coins: ils donnent le haut, la droite, la gauche et le bas de la grille
    const blobs = components(img, isPink).filter((c) => c.n >= 25).sort((a, b) => b.n - a.n).slice(0, 4);
    if (blobs.length < 4) {
      return { ok: false, reason: `Seulement ${blobs.length} glyphe(s) rose(s) reconnu(s): la capture doit montrer toute la grille, avec ses 4 coins roses.` };
    }
    const byY = blobs.slice().sort((a, b) => a.y - b.y);
    const top = byY[0];
    const bottom = byY[3];
    const middle = byY.slice(1, 3).sort((a, b) => a.x - b.x);
    const left = middle[0];
    const right = middle[1];
    // Coin (ligne 0, colonne 0) en haut, (0, dernière colonne) à droite, (dernière ligne, 0) à gauche, (dernière, dernière) en bas.
    const lastR = rows - 1;
    const lastC = cols - 1;
    const point = (r, c) => ({
      x: top.x + (r / lastR) * (left.x - top.x) + (c / lastC) * (right.x - top.x),
      y: top.y + (r / lastR) * (left.y - top.y) + (c / lastC) * (right.y - top.y),
    });
    // Vérification: le coin bas doit tomber près du glyphe détecté
    const check = point(lastR, lastC);
    const tile = Math.hypot(right.x - top.x, right.y - top.y) / lastC;
    if (Math.hypot(check.x - bottom.x, check.y - bottom.y) > tile * 1.5) {
      return { ok: false, reason: "Les 4 glyphes roses ne forment pas la grille attendue: recadre la capture sur le plateau." };
    }

    // 2. Couleur de chaque case
    const radius = Math.max(2, tile * 0.1);
    const colors = new Array(rows * cols).fill(0);
    const uncertain = [];
    let counted = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const ch = def.grid[r][c];
        const idx = r * cols + c;
        if (ch === "#" || ch === "P") continue;
        if (ch === "G") {
          colors[idx] = PINK;
          continue;
        }
        const p = point(r, c);
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let n = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const px = img.at(p.x + dx, p.y + dy);
            if (!px) continue;
            sr += px[0];
            sg += px[1];
            sb += px[2];
            n += 1;
          }
        }
        if (!n) continue;
        const result = classify(toHsl([sr / n, sg / n, sb / n]));
        colors[idx] = result.color;
        counted += 1;
        if (result.margin < 1.2 || result.d > 4) uncertain.push(idx);
      }
    }
    return { ok: true, colors, uncertain, tile, corners: { top, left, right, bottom }, counted };
  }

  const api = { analyze, classify, toHsl, CENTROIDS };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulRainikroneCapture = api;
  }
})(typeof self !== "undefined" ? self : this);
