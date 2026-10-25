// Moteur du combat « Extinction des feux » (Esprit de Bolgrot, Dofus Turquoise).
// Règles de jeu (guide + observations): après chaque action, les feux sont attirés d'une case vers le joueur
// (vers la case visée pour Immobilisme). Tuer un feu (en sautant dessus) repousse ses voisins d'une case, puis ils
// sont réattirés. Une répulsion bloquée (mur, feu, joueur) tue le joueur.
(function (root) {
  const W = 31;
  const H = 31;
  const PA_MAX = 10;
  const PV_CAP = 40;
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [-1, -1], [1, -1], [-1, 1]];

  const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const gx = (i) => i % W;
  const gy = (i) => (i / W) | 0;
  const cheb = (a, b) => Math.max(Math.abs(gx(a) - gx(b)), Math.abs(gy(a) - gy(b)));

  function makeCtx(def) {
    const blocked = new Uint8Array(W * H);
    def.board.forEach((row, y) => {
      for (let x = 0; x < W; x += 1) {
        if (row[x] === "#") blocked[y * W + x] = 1;
      }
    });
    blocked[def.bolgrot[1] * W + def.bolgrot[0]] = 1;
    return { blocked };
  }

  const inBoard = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

  // Pas d'un feu vers la cible: diagonale exacte si |dx| == |dy|, sinon l'axe dominant.
  function stepToward(f, t) {
    const dx = gx(t) - gx(f);
    const dy = gy(t) - gy(f);
    if (dx === 0 && dy === 0) return null;
    if (Math.abs(dx) === Math.abs(dy)) return [sgn(dx), sgn(dy)];
    return Math.abs(dx) > Math.abs(dy) ? [sgn(dx), 0] : [0, sgn(dy)];
  }

  // Case que viserait un feu (hors occupation): null si bord ou mur.
  function claimOf(ctx, f, t) {
    const st = stepToward(f, t);
    if (!st) return null;
    const x = gx(f) + st[0];
    const y = gy(f) + st[1];
    if (!inBoard(x, y) || ctx.blocked[y * W + x]) return null;
    return y * W + x;
  }

  function claimCounts(ctx, fires, t) {
    const counts = new Map();
    for (const f of fires) {
      const d = claimOf(ctx, f, t);
      if (d !== null) counts.set(d, (counts.get(d) || 0) + 1);
    }
    return counts;
  }

  // ---- Ordre de traitement des feux pendant une attraction ----
  const angleOf = (o, t) => {
    const sx = (gx(o) - gy(o)) - (gx(t) - gy(t));
    const sy = ((gx(o) + gy(o)) - (gx(t) + gy(t))) * 0.5;
    const a = Math.atan2(sx, -sy);
    return a < 0 ? a + 2 * Math.PI : a;
  };
  const manhattan = (a, b) => Math.abs(gx(a) - gx(b)) + Math.abs(gy(a) - gy(b));
  const diffOf = (c) => gx(c) - gy(c);
  function quadrantRank(o, t) {
    const dx = gx(o) - gx(t);
    const dy = gy(o) - gy(t);
    if (dx >= 0 && dy < 0) return 1;
    if (dx >= 0 && dy >= 0) return 2;
    if (dx < 0 && dy >= 0) return 3;
    return 0;
  }
  // Attraction séquentielle: chaque feu avance d'une case vers t s'il peut. Les feux tout juste repoussés passent d'abord.
  // Ordre de traitement: distance de Manhattan, puis (diagonale d'origine, angle) — inversés si la cible est à gauche du feu;
  // Immobilisme: Manhattan, quadrant, diagonale d'origine, angle. L'angle (coûteux) n'est calculé qu'en cas d'égalité.
  const scratch = new Uint8Array(W * H);
  function attract(ctx, fires, t, player, immo, repulsed) {
    const n = fires.length;
    const manh = new Array(n);
    const diff = new Array(n);
    const angle = new Array(n).fill(-1);
    const quad = immo ? new Array(n) : null;
    const tx = gx(t);
    for (let i = 0; i < n; i += 1) {
      manh[i] = manhattan(fires[i], t);
      diff[i] = diffOf(fires[i]);
      if (immo) quad[i] = quadrantRank(fires[i], t);
    }
    const ang = (i) => (angle[i] < 0 ? (angle[i] = angleOf(fires[i], t)) : angle[i]);
    const order = Array.from({ length: n }, (_, i) => i);
    order.sort((i, j) => {
      if (manh[i] !== manh[j]) return manh[i] - manh[j];
      if (immo) {
        if (quad[i] !== quad[j]) return quad[i] - quad[j];
        if (diff[i] !== diff[j]) return diff[i] - diff[j];
        const ai = ang(i);
        const aj = ang(j);
        return ai !== aj ? ai - aj : fires[i] - fires[j];
      }
      const iLeft = tx - gx(fires[i]) < 0;
      const jLeft = tx - gx(fires[j]) < 0;
      // Même distance: la clé dépend du côté de chaque feu; on compare avec la règle propre à chacun, comme l'ordre d'origine.
      if (!iLeft && !jLeft) {
        if (diff[i] !== diff[j]) return diff[i] - diff[j];
        const ai = ang(i);
        const aj = ang(j);
        return ai !== aj ? ai - aj : fires[i] - fires[j];
      }
      if (iLeft && jLeft) {
        const ai = ang(i);
        const aj = ang(j);
        if (ai !== aj) return ai - aj;
        return diff[i] !== diff[j] ? diff[i] - diff[j] : fires[i] - fires[j];
      }
      // Clés de forme différente: [manh, angle, diff, id] contre [manh, diff, angle, id]
      const ki = iLeft ? [ang(i), diff[i]] : [diff[i], ang(i)];
      const kj = jLeft ? [ang(j), diff[j]] : [diff[j], ang(j)];
      if (ki[0] !== kj[0]) return ki[0] - kj[0];
      if (ki[1] !== kj[1]) return ki[1] - kj[1];
      return fires[i] - fires[j];
    });
    const pos = fires.slice();
    for (let i = 0; i < n; i += 1) scratch[fires[i]] = 1;
    const passes = repulsed && repulsed.size ? 2 : 1;
    for (let pass = 0; pass < passes; pass += 1) {
      for (let k = 0; k < n; k += 1) {
        const idx = order[k];
        const f = fires[idx];
        if (passes === 2 && (repulsed.has(f) ? 0 : 1) !== pass) continue;
        const st = stepToward(f, t);
        if (!st) continue;
        const x = gx(f) + st[0];
        const y = gy(f) + st[1];
        if (!inBoard(x, y)) continue;
        const d = y * W + x;
        if (ctx.blocked[d] || d === player || scratch[d]) continue;
        if (st[0] !== 0 && st[1] !== 0) {
          const sideA = gy(f) * W + (gx(f) + st[0]);
          const sideB = (gy(f) + st[1]) * W + gx(f);
          if (ctx.blocked[sideA] || scratch[sideA] || sideA === player || ctx.blocked[sideB] || scratch[sideB] || sideB === player) continue;
        }
        scratch[f] = 0;
        scratch[d] = 1;
        pos[idx] = d;
      }
    }
    for (let i = 0; i < n; i += 1) scratch[pos[i]] = 0;
    return pos;
  }

  // Répulsion après un kill en k: les feux voisins (8 cases) reculent d'une case. null = mort.
  function repulse(ctx, fires, k, playerBefore, playerAfter) {
    const set = new Set(fires);
    const affected = fires.filter((f) => cheb(f, k) === 1);
    if (!affected.length) return { fires, moves: [] };
    const origins = new Set(affected);
    const moves = [];
    const counts = new Map();
    for (const f of affected) {
      const x = gx(f) + sgn(gx(f) - gx(k));
      const y = gy(f) + sgn(gy(f) - gy(k));
      if (!inBoard(x, y)) return null;
      const d = y * W + x;
      if (ctx.blocked[d] || d === playerBefore || d === playerAfter) return null;
      moves.push([f, d]);
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    for (const [, d] of moves) {
      if (set.has(d) && !origins.has(d)) return null;
      if (counts.get(d) > 1) return null;
    }
    const result = new Set(fires);
    affected.forEach((f) => result.delete(f));
    moves.forEach(([, d]) => result.add(d));
    return { fires: [...result], moves };
  }

  const fail = (why, reason) => {
    if (why) why.reason = reason;
    return null;
  };

  // ---- Une action ----
  // state = { p, fires:number[], pv, pa, doubles, turn }; action = { kind: "end"|"astral"|"double"|"immo", dx, dy }
  // Renvoie le nouvel état, ou null si l'action est impossible ou fatale.
  function apply(ctx, state, action, why) {
    if (action.kind === "end") {
      const pv = state.pv - (state.turn >= 6 ? 1 : 0);
      if (pv <= 0) return fail(why, "fin de tour fatale");
      let fires = state.fires;
      // Au tour 6, les cases violettes deviennent des feux (sauf si le joueur ou un feu les occupe).
      if (state.glyphs && state.glyphs.length) {
        const taken = new Set(fires);
        taken.add(state.p);
        fires = fires.concat(state.glyphs.filter((g) => !taken.has(g)));
      }
      return { p: state.p, fires, pv, pa: PA_MAX, doubles: 0, turn: state.turn + 1 };
    }
    const px = gx(state.p);
    const py = gy(state.p);

    if (action.kind === "immo") {
      if (state.pa < 1 || state.pv <= 5) return fail(why, "immo impossible");
      const x = px + action.dx;
      const y = py + action.dy;
      if (!inBoard(x, y) || ctx.blocked[y * W + x]) return fail(why, "immo cible");
      const fires = attract(ctx, state.fires, y * W + x, state.p, true, null);
      return { p: state.p, fires, pv: state.pv - 5, pa: state.pa - 1, doubles: state.doubles, turn: state.turn, glyphs: state.glyphs };
    }

    const double = action.kind === "double";
    const cost = double ? 2 : 1;
    if (state.pa < cost || (double && state.doubles >= 2)) return fail(why, "saut impossible");
    const dist = double ? 2 : 1;
    const x = px + action.dx * dist;
    const y = py + action.dy * dist;
    if (!inBoard(x, y) || ctx.blocked[y * W + x]) return fail(why, "saut cible");
    const target = y * W + x;
    const fireSet = new Set(state.fires);
    let inter = -1;
    if (double) {
      inter = (py + action.dy) * W + (px + action.dx);
      if (ctx.blocked[inter] || fireSet.has(inter)) return fail(why, "intermédiaire");
    }
    const kill = fireSet.has(target);
    if (!kill && state.fires.some((f) => cheb(f, target) === 1)) return fail(why, "atterrissage près d'un feu");

    let pv = state.pv - 1;
    let fires = state.fires;
    let repulsed = null;
    if (kill) {
      fires = fires.filter((f) => f !== target);
      pv = Math.min(PV_CAP, pv + 1);
      if (!fires.length) {
        return { p: target, fires, pv, pa: state.pa - cost, doubles: state.doubles + (double ? 1 : 0), turn: state.turn, glyphs: state.glyphs, won: true };
      }
      const rep = repulse(ctx, fires, target, state.p, target);
      if (!rep) return fail(why, "répulsion bloquée");
      fires = rep.fires;
      repulsed = new Set(rep.moves.map((m) => m[1]));
      const counts = claimCounts(ctx, fires, target);
      for (const [origin, cell] of rep.moves) {
        if (claimOf(ctx, cell, target) === origin && (counts.get(origin) || 0) >= 2) return fail(why, "origine reprise");
      }
    }
    if (pv <= 0) return fail(why, "PV");

    if (double) {
      for (const f of fires) {
        if (claimOf(ctx, f, target) !== target) continue;
        const dx = sgn(x - gx(f));
        const dy = sgn(y - gy(f));
        if (dx === 0 || dy === 0) continue;
        const sideA = gy(f) * W + (gx(f) + dx);
        const sideB = (gy(f) + dy) * W + gx(f);
        if (inter === sideA || inter === sideB) return fail(why, "diagonale intermédiaire");
      }
    }
    // Un feu qui vise le joueur alors qu'un autre feu vise sa propre case: collision en chaîne.
    const claims = claimCounts(ctx, fires, target);
    for (const f of fires) {
      if (claimOf(ctx, f, target) === target && (claims.get(f) || 0) >= 1) return fail(why, "chaîne vers le joueur");
    }

    fires = attract(ctx, fires, target, target, false, repulsed);
    return { p: target, fires, pv, pa: state.pa - cost, doubles: state.doubles + (double ? 1 : 0), turn: state.turn, glyphs: state.glyphs };
  }

  function actionsOf(state) {
    const out = [{ kind: "end" }];
    if (state.pa >= 1) ORTHO.forEach(([dx, dy]) => out.push({ kind: "astral", dx, dy }));
    if (state.pa >= 2 && state.doubles < 2) ORTHO.forEach(([dx, dy]) => out.push({ kind: "double", dx, dy }));
    if (state.pa >= 1 && state.pv > 5) DIAG.forEach(([dx, dy]) => out.push({ kind: "immo", dx, dy }));
    return out;
  }

  const api = { W, H, PA_MAX, ORTHO, DIAG, makeCtx, apply, actionsOf, attract, repulse, claimOf, claimCounts, cheb, gx, gy };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TnulBolgrotEngine = api;
  }
})(typeof self !== "undefined" ? self : this);
