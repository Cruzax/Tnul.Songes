(function (root) {
  const COLS = 14;
  const ROWS = 40;

  function toScreen(u, v) {
    return { px: u + v, py: u - v };
  }

  function fromScreen(px, py) {
    return { u: (px + py) / 2, v: (px - py) / 2 };
  }

  function isValid(u, v) {
    const px = u + v;
    const py = u - v;
    if (py < 0 || py >= ROWS) {
      return false;
    }
    const col = (px - (py % 2)) / 2;
    return Number.isInteger(col) && col >= 0 && col < COLS;
  }

  function allCells() {
    const cells = [];
    for (let py = 0; py < ROWS; py += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const px = col * 2 + (py % 2);
        cells.push(fromScreen(px, py));
      }
    }
    return cells;
  }

  function distance(a, b) {
    return Math.abs(a.u - b.u) + Math.abs(a.v - b.v);
  }

  // Direction unitaire du lanceur vers la cible (axe dominant). Par défaut (1, 0).
  function direction(from, to) {
    const du = to.u - from.u;
    const dv = to.v - from.v;
    if (du === 0 && dv === 0) {
      return { du: 1, dv: 0 };
    }
    if (Math.abs(du) >= Math.abs(dv)) {
      return { du: Math.sign(du), dv: 0 };
    }
    return { du: 0, dv: Math.sign(dv) };
  }

  // Ligne de vue: on échantillonne le segment entre les centres et on regarde les cases traversées.
  function hasLineOfSight(a, b, blocked) {
    if (!blocked || blocked.size === 0) {
      return true;
    }
    const d = Math.max(Math.abs(b.u - a.u), Math.abs(b.v - a.v));
    if (d <= 1) {
      return true;
    }
    const steps = d * 4;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const u = Math.round(a.u + (b.u - a.u) * t);
      const v = Math.round(a.v + (b.v - a.v) * t);
      if ((u === a.u && v === a.v) || (u === b.u && v === b.v)) {
        continue;
      }
      if (blocked.has(`${u},${v}`)) {
        return false;
      }
    }
    return true;
  }

  // Cases visibles depuis une origine (les murs eux-mêmes comptent comme visibles).
  function visibleKeys(origin, blocked) {
    const seen = new Set();
    allCells().forEach((cell) => {
      if (hasLineOfSight(origin, cell, blocked)) {
        seen.add(`${cell.u},${cell.v}`);
      }
    });
    return seen;
  }

  // blocked: cases impossibles à cibler (obstacles). losBlockers: ce qui coupe la ligne de vue (par défaut les
  // mêmes obstacles; on y ajoute les personnages, qui cachent la vue mais restent ciblables).
  function rangeCells(origin, spell, blocked, losBlockers = blocked) {
    const min = spell.poMin || 0;
    const max = spell.poMax || 0;
    return allCells().filter((cell) => {
      const du = cell.u - origin.u;
      const dv = cell.v - origin.v;
      const d = Math.abs(du) + Math.abs(dv);
      if (d < min || d > max || d === 0) {
        return false;
      }
      if (blocked && blocked.has(`${cell.u},${cell.v}`)) {
        return false;
      }
      if (spell.los && !hasLineOfSight(origin, cell, losBlockers)) {
        return false;
      }
      if (spell.line && du !== 0 && dv !== 0) {
        return false;
      }
      if (spell.diagonal && Math.abs(du) !== Math.abs(dv)) {
        return false;
      }
      return true;
    });
  }

  function zoneCells(target, caster, zone) {
    const n = zone.size1 || 0;
    const m = zone.size2 || 0;
    const dir = direction(caster, target);
    const perp = { du: dir.dv, dv: dir.du };
    const seen = new Set();
    const out = [];
    const push = (u, v) => {
      const k = `${u},${v}`;
      if (!seen.has(k) && isValid(u, v)) {
        seen.add(k);
        out.push({ u, v });
      }
    };

    switch (zone.shape) {
      case "all":
        return allCells();
      case "circle":
        for (let du = -n; du <= n; du += 1) {
          for (let dv = -n; dv <= n; dv += 1) {
            const d = Math.abs(du) + Math.abs(dv);
            if (d <= n && d >= m) {
              push(target.u + du, target.v + dv);
            }
          }
        }
        break;
      case "cross":
        for (let k = -n; k <= n; k += 1) {
          push(target.u + k, target.v);
          push(target.u, target.v + k);
        }
        break;
      case "diagonalCross":
        for (let k = -n; k <= n; k += 1) {
          push(target.u + k, target.v + k);
          push(target.u + k, target.v - k);
        }
        break;
      case "line":
        for (let k = 0; k <= n; k += 1) {
          push(target.u + dir.du * k, target.v + dir.dv * k);
        }
        break;
      case "perpendicular":
        for (let k = -n; k <= n; k += 1) {
          push(target.u + perp.du * k, target.v + perp.dv * k);
        }
        break;
      case "cone":
        for (let k = 0; k <= n; k += 1) {
          for (let w = -k; w <= k; w += 1) {
            push(target.u + dir.du * k + perp.du * w, target.v + dir.dv * k + perp.dv * w);
          }
        }
        break;
      case "square":
        for (let du = -n; du <= n; du += 1) {
          for (let dv = -n; dv <= n; dv += 1) {
            push(target.u + du, target.v + dv);
          }
        }
        break;
      default:
        push(target.u, target.v);
    }
    return out;
  }

  const api = { COLS, ROWS, toScreen, fromScreen, isValid, allCells, distance, direction, hasLineOfSight, visibleKeys, rangeCells, zoneCells };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.TnulGrid = api;
})(typeof window !== "undefined" ? window : globalThis);
