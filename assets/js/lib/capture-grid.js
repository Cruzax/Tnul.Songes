// Lecture de capture pour les cartes isométriques (Souffles, petites machines, boules).
// Le joueur colle sa capture (Ctrl+V, glisser-déposer ou fichier), puis clique sur 3 cases repères montrées
// sur la carte du site: une transformation affine relie alors chaque case (a, b) à un point de la capture.
// La détection elle-même (ce qu'il y a sur chaque case) est faite par chaque page avec read(sample).
// Script classique: expose CaptureGrid.
(function (root) {
  // Transformation affine exacte par 3 points: (a, b) -> (x, y)
  function affine(grid, image) {
    const [[a1, b1], [a2, b2], [a3, b3]] = grid;
    const det = a1 * (b2 - b3) - b1 * (a2 - a3) + (a2 * b3 - a3 * b2);
    if (Math.abs(det) < 1e-9) return null;
    const solve = (v1, v2, v3) => [
      (v1 * (b2 - b3) - b1 * (v2 - v3) + (v2 * b3 - v3 * b2)) / det,
      (a1 * (v2 - v3) - v1 * (a2 - a3) + (a2 * v3 - a3 * v2)) / det,
      (a1 * (b2 * v3 - b3 * v2) - b1 * (a2 * v3 - a3 * v2) + v1 * (a2 * b3 - a3 * b2)) / det,
    ];
    const [px, qx, rx] = solve(image[0][0], image[1][0], image[2][0]);
    const [py, qy, ry] = solve(image[0][1], image[1][1], image[2][1]);
    const toImage = (a, b) => [px * a + qx * b + rx, py * a + qy * b + ry];
    const D = px * qy - qx * py;
    const toGrid = (x, y) => [(qy * (x - rx) - qx * (y - ry)) / D, (px * (y - ry) - py * (x - rx)) / D];
    // Taille d'une case à l'écran: écart entre deux cases voisines (sert à régler les zones lues)
    const cell = Math.hypot(px - qx, py - qy);
    return { toImage, toGrid, cell };
  }

  function hsl(r8, g8, b8) {
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
    return { hue, sat, light };
  }

  // Pixels d'une zone autour d'une case: dx et dy en fractions de case (0 = centre, dy < 0 = au-dessus)
  function makeSampler(pixels, width, height, map) {
    const region = (a, b, box) => {
      const [cx, cy] = map.toImage(a, b);
      const s = map.cell;
      const out = [];
      const step = Math.max(1, Math.round(s / 24));
      for (let y = cy + box.y0 * s; y <= cy + box.y1 * s; y += step) {
        for (let x = cx + box.x0 * s; x <= cx + box.x1 * s; x += step) {
          const xi = Math.round(x);
          const yi = Math.round(y);
          if (xi < 0 || yi < 0 || xi >= width || yi >= height) continue;
          const i = (yi * width + xi) * 4;
          out.push(hsl(pixels[i], pixels[i + 1], pixels[i + 2]));
        }
      }
      return out;
    };
    return { region, map };
  }

  // Fenêtre de calibrage: affiche la capture, demande les clics, puis appelle done(sampler, clicks)
  function open(options) {
    const { image, anchors, extra = [], done } = options;
    const dialog = document.createElement("div");
    dialog.className = "cg-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Caler la capture");
    dialog.innerHTML = '<div class="cg-box"><p class="cg-step"></p><div class="cg-body"><div class="cg-stage"><canvas></canvas></div><div class="cg-map" aria-hidden="true"></div></div>'
      + '<div class="cg-actions"><button type="button" class="cg-undo">Annuler le dernier clic</button><button type="button" class="cg-close">Fermer</button></div></div>';
    document.body.appendChild(dialog);
    const canvas = dialog.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const steps = [...anchors.map((a) => ({ ...a, anchor: true })), ...extra];
    const clicks = [];
    const stepNode = dialog.querySelector(".cg-step");

    function paint() {
      ctx.drawImage(image, 0, 0);
      clicks.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(6, canvas.width / 160), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, canvas.width / 500);
        ctx.strokeStyle = i < anchors.length ? "#6ebaed" : "#f2c94c";
        ctx.stroke();
      });
      const current = steps[clicks.length];
      stepNode.textContent = current ? `${clicks.length + 1} / ${steps.length} · ${current.label}` : "";
      if (options.highlight) options.highlight(current && current.cell);
      // Mini-carte du site avec la case repère en bleu (la carte de la page est cachée par la fenêtre)
      const mini = dialog.querySelector(".cg-map");
      mini.textContent = "";
      if (options.preview && current && current.cell) mini.appendChild(options.preview());
      mini.hidden = !mini.firstChild;
    }

    function close() {
      if (options.highlight) options.highlight(null);
      dialog.remove();
      document.removeEventListener("keydown", onKey);
    }
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      clicks.push([x, y]);
      if (clicks.length < steps.length) {
        paint();
        return;
      }
      const map = affine(anchors.map((a) => a.cell), clicks.slice(0, anchors.length));
      if (!map) {
        clicks.length = 0;
        stepNode.textContent = "Les 3 repères sont alignés : recommence en cliquant bien sur les cases demandées.";
        return;
      }
      close();
      done(makeSampler(pixels, canvas.width, canvas.height, map), clicks.slice(anchors.length).map(([x, y]) => map.toGrid(x, y).map(Math.round)));
    });
    dialog.querySelector(".cg-undo").addEventListener("click", () => {
      clicks.pop();
      paint();
    });
    dialog.querySelector(".cg-close").addEventListener("click", close);
    paint();
  }

  // Branche le collage (Ctrl+V), le glisser-déposer et un bouton fichier sur une page; onImage(img) à chaque capture
  function listen({ button, drop, onImage }) {
    const load = (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      const img = new Image();
      img.onload = () => {
        onImage(img);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    document.addEventListener("paste", (event) => {
      const item = [...(event.clipboardData ? event.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
      if (item) load(item.getAsFile());
    });
    if (drop) {
      drop.addEventListener("dragover", (event) => event.preventDefault());
      drop.addEventListener("drop", (event) => {
        event.preventDefault();
        load(event.dataTransfer.files[0]);
      });
    }
    if (button) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.hidden = true;
      button.after(input);
      button.addEventListener("click", () => input.click());
      input.addEventListener("change", () => load(input.files[0]));
    }
  }

  // Petites statistiques sur une liste de pixels
  const share = (list, test) => (list.length ? list.filter(test).length / list.length : 0);

  root.CaptureGrid = { affine, open, listen, share, hsl };
})(typeof self !== "undefined" ? self : this);
