// Fond animé discret: grille isométrique (2:1, comme la simulation) dont quelques cases s'allument doucement.
// Les couleurs viennent des variables de assets/css/theme.css. Script classique, aucune dépendance.
(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) {
    return;
  }
  const context = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CELL_W = 72; // largeur d'une case (hauteur = moitié)
  const CELL_H = CELL_W / 2;
  const MAX_GLOWS = 16;
  const FRAME_MS = 1000 / 30; // 30 images par seconde suffisent pour un fond lent

  const channels = (name) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return raw ? raw.split(/\s+/).join(",") : "110,186,237";
  };
  const colors = {
    line: channels("--c-line"),
    glow: [channels("--c-accent"), channels("--c-accent"), channels("--c-accent"), channels("--c-movement")],
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let glows = [];
  let last = 0;
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    glows = [];
  }

  // Une case = (colonne, ligne) de la grille isométrique; centre à l'écran
  const centerOf = (col, row) => ({ x: (col + (row % 2) / 2) * CELL_W, y: (row * CELL_H) / 2 });

  function spawnGlow(now) {
    const cols = Math.ceil(width / CELL_W) + 1;
    const rows = Math.ceil(height / (CELL_H / 2)) + 1;
    glows.push({
      col: Math.floor(Math.random() * cols),
      row: Math.floor(Math.random() * rows),
      born: now,
      life: 5000 + Math.random() * 5000,
      peak: 0.1 + Math.random() * 0.1,
      color: colors.glow[Math.floor(Math.random() * colors.glow.length)],
    });
  }

  function diamond(x, y) {
    context.beginPath();
    context.moveTo(x - CELL_W / 2, y);
    context.lineTo(x, y - CELL_H / 2);
    context.lineTo(x + CELL_W / 2, y);
    context.lineTo(x, y + CELL_H / 2);
    context.closePath();
  }

  function drawGrid() {
    context.strokeStyle = `rgba(${colors.line}, 0.7)`;
    context.lineWidth = 1;
    context.beginPath();
    // Deux familles de diagonales de pente ±1/2: elles dessinent les bords des cases
    for (let x = -height * 2; x <= width + height * 2; x += CELL_W) {
      context.moveTo(x, 0);
      context.lineTo(x + height * 2, height);
      context.moveTo(x, 0);
      context.lineTo(x - height * 2, height);
    }
    context.stroke();
  }

  function frame(now) {
    if (!running) {
      return;
    }
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) {
      return;
    }
    last = now;

    // Taille de la fenêtre pas encore connue au chargement (ou changée sans événement): on se recale
    if (width !== window.innerWidth || height !== window.innerHeight) {
      resize();
    }
    context.clearRect(0, 0, width, height);
    drawGrid();

    glows = glows.filter((glow) => now - glow.born < glow.life);
    while (glows.length < MAX_GLOWS) {
      spawnGlow(now - Math.random() * 3000);
    }
    glows.forEach((glow) => {
      const progress = (now - glow.born) / glow.life;
      const alpha = Math.sin(Math.PI * Math.min(Math.max(progress, 0), 1)) * glow.peak;
      const { x, y } = centerOf(glow.col, glow.row);
      diamond(x, y);
      context.fillStyle = `rgba(${glow.color}, ${alpha.toFixed(3)})`;
      context.fill();
      context.strokeStyle = `rgba(${glow.color}, ${(alpha * 2).toFixed(3)})`;
      context.stroke();
    });
  }

  function drawStatic() {
    context.clearRect(0, 0, width, height);
    drawGrid();
    for (let i = 0; i < MAX_GLOWS; i += 1) {
      spawnGlow(0);
    }
    glows.forEach((glow) => {
      const { x, y } = centerOf(glow.col, glow.row);
      diamond(x, y);
      context.fillStyle = `rgba(${glow.color}, 0.05)`;
      context.fill();
    });
  }

  function start() {
    resize();
    if (reduceMotion) {
      drawStatic(); // pas d'animation si l'utilisateur la désactive
      return;
    }
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) {
      drawStatic();
    }
  });
  // On économise le processeur quand l'onglet n'est pas visible
  document.addEventListener("visibilitychange", () => {
    if (reduceMotion) {
      return;
    }
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });

  start();
})();
