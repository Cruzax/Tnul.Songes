// Lecture d'une capture d'écran du combat de Bolgrot: feux (anneaux orange), glyphes violets et joueur (anneau bleu).
// La grille est calée sur Bolgrot, dont la case (20,10) est fixe: son anneau orange est le plus large de l'écran.
(function (root) {
  const W = 31;
  const H = 31;
  const BOLGROT = [20, 10];

  const make = (pixels) => {
    const { data, width, height } = pixels;
    const at = (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= width || yi >= height) return null;
      const i = (yi * width + xi) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    return { width, height, at };
  };

  const isOrange = ([r, g, b]) => r > 170 && r - b > 100 && g < r - 40 && g > 40;
  const isBlue = ([r, g, b]) => b > 105 && r < 90 && b - r > 70 && b - g > 30;
  const isPurple = ([r, g, b]) => b - g >= 15 && r - g >= 10 && r >= 60 && r < 200 && b - r < 70;

  function components(img, mask) {
    const { width, height, at } = img;
    const seen = new Uint8Array(width * height);
    const out = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (seen[i]) continue;
        const px = at(x, y);
        if (!px || !mask(px)) continue;
        const stack = [[x, y]];
        seen[i] = 1;
        let n = 0;
        let minx = x;
        let maxx = x;
        let miny = y;
        let maxy = y;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          n += 1;
          if (cx < minx) minx = cx;
          if (cx > maxx) maxx = cx;
          if (cy < miny) miny = cy;
          if (cy > maxy) maxy = cy;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const j = ny * width + nx;
              if (seen[j]) continue;
              const q = at(nx, ny);
              if (q && mask(q)) {
                seen[j] = 1;
                stack.push([nx, ny]);
              }
            }
          }
        }
        out.push({ n, minx, maxx, miny, maxy, w: maxx - minx, h: maxy - miny });
      }
    }
    return out;
  }

  // Part de points colorés sur un losange d'un rayon donné (en fraction de la case) autour de (cx, cy).
  function ringScore(img, cx, cy, A, mask, kx, ky) {
    const tol = Math.max(1, Math.round(A / 22));
    let hit = 0;
    let total = 0;
    for (let t = 0; t < 16; t += 1) {
      const a = (t / 16) * 2 * Math.PI;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      // Point du losange |x|/kx + |y|/ky = 1 dans la direction (ux, uy)
      const scale = 1 / (Math.abs(ux) / kx + Math.abs(uy) / ky);
      const x = cx + ux * scale * A;
      const y = cy + uy * scale * A;
      total += 1;
      let found = false;
      for (let dy = -tol; dy <= tol && !found; dy += 1) {
        for (let dx = -tol; dx <= tol && !found; dx += 1) {
          const px = img.at(x + dx, y + dy);
          if (px && mask(px)) found = true;
        }
      }
      if (found) hit += 1;
    }
    return hit / total;
  }

  // L'intérieur d'un glyphe est légèrement teinté de violet (le sol est vert-bleu).
  function tinted(img, cx, cy, A) {
    let hit = 0;
    let total = 0;
    for (const [ux, uy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.18], [0, -0.18], [0.15, 0.08], [-0.15, -0.08]]) {
      const px = img.at(cx + ux * A, cy + uy * A);
      if (!px) continue;
      total += 1;
      if (px[2] - px[1] >= 4) hit += 1;
    }
    return total > 0 && hit / total >= 0.6;
  }

  function analyze(pixels, def) {
    const img = make(pixels);
    const blocked = (gx, gy) => gx < 0 || gy < 0 || gx >= W || gy >= H || def.board[gy][gx] === "#";

    // 1. Bolgrot: l'anneau orange le plus large et aplati
    const rings = components(img, isOrange).filter((c) => c.n >= 30 && c.h < c.w * 0.62 && c.h > c.w * 0.3 && c.w >= 20 && c.n < c.w * c.h * 0.55);
    if (!rings.length) {
      return { ok: false, reason: "Bolgrot introuvable: la capture doit montrer tout le plateau, avec les feux." };
    }
    const bol = rings.reduce((best, c) => (c.w > best.w ? c : best), rings[0]);
    let A = (bol.maxx - bol.minx) / 1.7;
    let cx0 = (bol.minx + bol.maxx) / 2;
    let cy0 = (bol.miny + bol.maxy) / 2;
    const cellCenter = (gx, gy, a, ox, oy) => ({
      x: ox + ((gx - BOLGROT[0]) - (gy - BOLGROT[1])) * a,
      y: oy + ((gx - BOLGROT[0]) + (gy - BOLGROT[1])) * (a / 2),
    });

    // 2. Affinage de l'échelle et du décalage sur les anneaux de feu (petits losanges orange)
    const cells = [];
    for (let gy = 0; gy < H; gy += 1) {
      for (let gx = 0; gx < W; gx += 1) {
        if (!blocked(gx, gy) && !(gx === BOLGROT[0] && gy === BOLGROT[1])) cells.push([gx, gy]);
      }
    }
    const fireScore = (a, ox, oy) => {
      let total = 0;
      for (const [gx, gy] of cells) {
        const c = cellCenter(gx, gy, a, ox, oy);
        const s = ringScore(img, c.x, c.y, a, isOrange, 0.64, 0.29);
        if (s > 0.3) total += s * s;
      }
      return total;
    };
    let best = { score: -1, A, ox: cx0, oy: cy0 };
    for (let a = A * 0.88; a <= A * 1.12; a += A * 0.02) {
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -2; dy <= 2; dy += 1) {
          const s = fireScore(a, cx0 + dx, cy0 + dy);
          if (s > best.score) best = { score: s, A: a, ox: cx0 + dx, oy: cy0 + dy };
        }
      }
    }
    A = best.A;
    cx0 = best.ox;
    cy0 = best.oy;

    // 3. Lecture des cases
    const fires = [];
    const glyphs = [];
    let player = null;
    let playerScore = 0;
    for (const [gx, gy] of cells) {
      const c = cellCenter(gx, gy, A, cx0, cy0);
      const idx = gy * W + gx;
      const fire = ringScore(img, c.x, c.y, A, isOrange, 0.64, 0.29);
      const blue = ringScore(img, c.x, c.y, A, isBlue, 0.82, 0.41);
      if (blue > 0.25 && blue > playerScore) {
        player = idx;
        playerScore = blue;
      }
      if (fire >= 0.3) {
        fires.push(idx);
        continue;
      }
      // Glyphe violet: contour violet sur tout le tour de la case
      if (ringScore(img, c.x, c.y, A, isPurple, 0.98, 0.49) >= 0.55 && tinted(img, c.x, c.y, A)) glyphs.push(idx);
    }
    return { ok: true, fires, glyphs, player, scale: A, center: { x: cx0, y: cy0 }, fireScore: best.score };
  }

  const api = { analyze, ringScore, isOrange, isBlue, isPurple, make };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulBolgrotCapture = api;
  }
})(typeof self !== "undefined" ? self : this);
