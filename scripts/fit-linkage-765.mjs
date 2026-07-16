// ============================================================
// Oracle fit: Triumph Street Triple RS 765 stock linkage
// ============================================================
//
// Data source: real MotoSPEC PRO screenshots (2026-07-16), see
// docs/research/triumph-765-motospec.md. Known link dimensions
// (swingarm-mounted rocker = our 'pro-link' mode):
//   rocker triangle  pivot–shock 77.70, pivot–linkarm 45.30,
//                    shock–linkarm 57.65 mm
//   linkarm length   169.20 mm
//   shock length     283.0 mm (Öhlins STX40, eye-to-eye)
//
// Unknown: WHERE those parts sit (rocker pivot on the swingarm, frame
// linkarm anchor, frame shock top). Per the oracle-extraction plan we fit
// an EQUIVALENCE-CLASS member: any coordinate set that reproduces the
// observed shock↔wheel-travel curve is functionally identical for every
// channel we compute. Targets from the oracle's motion-ratio chart:
//   MR(travel=0)    = 2.458   (displayed)
//   MR(travel≈135)  ≈ 1.956   (chart end; consistent with Progression
//                              25.6% = (2.458−1.956)/1.956)
//   MR decline ≈ linear in wheel travel (chart shape)
//
// Parameterization keeps every KNOWN length exact by construction; only
// placement angles/position are free:
//   P  = rocker pivot on swingarm           (px, py)
//   S  = P + 77.70·u(θ)                     shock end of rocker
//   D  = P + 45.30·u(θ + s·γ)               linkarm end (γ from triangle)
//   T  = D + 169.20·u(φ)                    frame linkarm anchor
//   F  = S + 283.0·u(ψ)                     frame shock top
// Free: px, py, θ, φ, ψ (+ triangle reflection s = ±1).
//
// Run: node scripts/fit-linkage-765.mjs

import { motionRatio, shockLength } from '../src/linkage.js';

const D2R = Math.PI / 180;
const L = 594.5;          // swingarm length (oracle)
const BETA = 12.23;       // static swingarm angle (from RRH −125.9 = −L·sinβ)

// Rocker triangle interior angle at the pivot
const a = 77.70, b = 45.30, c = 57.65;
const GAMMA = Math.acos((a * a + b * b - c * c) / (2 * a * b));

const u = (t) => [Math.cos(t), Math.sin(t)];

function buildCfg([px, py, th, phi, psi], s) {
  const P = [px, py];
  const S = [px + a * Math.cos(th), py + a * Math.sin(th)];
  const D = [px + b * Math.cos(th + s * GAMMA), py + b * Math.sin(th + s * GAMMA)];
  const T = [D[0] + 169.2 * Math.cos(phi), D[1] + 169.2 * Math.sin(phi)];
  const F = [S[0] + 283.0 * Math.cos(psi), S[1] + 283.0 * Math.sin(psi)];
  return {
    Linkage_Mode: 'pro-link',
    Frame_Rocker_Pivot_X: P[0], Frame_Rocker_Pivot_Y: P[1],
    Rocker_To_Shock_X: S[0],    Rocker_To_Shock_Y: S[1],
    Rocker_To_Drag_X: D[0],     Rocker_To_Drag_Y: D[1],
    Drag_To_Swingarm_X: T[0],   Drag_To_Swingarm_Y: T[1],
    Frame_Shock_Top_X: F[0],    Frame_Shock_Top_Y: F[1],
  };
}

// Wheel travel t (mm, axle up) → swingarm delta (deg, negative in bump)
function deltaForTravel(t) {
  const s0 = Math.sin(BETA * D2R);
  return Math.asin(s0 - t / L) / D2R - BETA;
}

// Fit targets: (travel mm, MR) — endpoint values from the oracle display,
// midpoints from the chart's near-linear decline.
const TARGETS = [
  [0, 2.458],
  [34, 2.33],
  [67.5, 2.20],
  [101, 2.08],
  [135, 1.956],
];

function objective(x, s) {
  const cfg = buildCfg(x, s);
  let err = 0;
  for (const [t, want] of TARGETS) {
    const mr = motionRatio(cfg, deltaForTravel(t), L, BETA);
    if (!Number.isFinite(mr)) return 1e9;
    err += (mr - want) ** 2;
  }
  // Mechanism must stay solvable slightly beyond the range
  if (!Number.isFinite(shockLength(cfg, deltaForTravel(140))) ||
      !Number.isFinite(shockLength(cfg, 2))) return 1e9;
  // Shock must COMPRESS in bump (stroke ≈ travel / MR ≈ 60 mm)
  const stroke = shockLength(cfg, 0) - shockLength(cfg, deltaForTravel(135));
  if (!(stroke > 20)) return 1e9;
  err += 0.0005 * ((stroke - 61) / 10) ** 2; // soft: stroke ≈ 135/avgMR
  // Layout constraints from the owner's description of the real bike
  // (2026-07-16), screen-left = +X forward, numbered as in the topology SVG:
  //   ⑥ below ①        → T_y < 0, roughly under the pivot (|T_x| small)
  //   ⑦ left of ③④⑤   → F_x > max(P_x, S_x, D_x)
  //   ③ below line ①-② → P_y < P_x·tan(β)  (under the swingarm)
  //   ④ left of ③⑤     → S_x > P_x and S_x > D_x
  //   ⑤ left of ③       → D_x > P_x
  // Enforced as heavy penalties (≫ kinematic residuals when violated), so
  // the optimizer picks the equivalence-class member with this layout.
  const W = 1e-3, M = 5; // weight per mm², margin mm
  const viol = (v) => Math.max(0, v) ** 2 * W;
  const P = [cfg.Frame_Rocker_Pivot_X, cfg.Frame_Rocker_Pivot_Y];
  const S = [cfg.Rocker_To_Shock_X, cfg.Rocker_To_Shock_Y];
  const D = [cfg.Rocker_To_Drag_X, cfg.Rocker_To_Drag_Y];
  const T = [cfg.Drag_To_Swingarm_X, cfg.Drag_To_Swingarm_Y];
  const F = [cfg.Frame_Shock_Top_X, cfg.Frame_Shock_Top_Y];
  err += viol(T[1] + M);                                  // ⑥ below ①
  err += viol(Math.abs(T[0]) - 90);                       // ⑥ roughly under ①
  err += viol(Math.max(P[0], S[0], D[0]) + M - F[0]);     // ⑦ fwd of ③④⑤
  err += viol(P[1] - P[0] * Math.tan(BETA * D2R) + M);    // ③ under the ①-② line
  err += viol(P[0] + M - S[0]) + viol(D[0] + M - S[0]);   // ④ fwd of ③ and ⑤
  err += viol(P[0] + M - D[0]);                           // ⑤ fwd of ③
  // Keep the assembly bike-sized
  const pen = (v, lo, hi) => (v < lo ? (lo - v) : v > hi ? (v - hi) : 0) ** 2 * 1e-4;
  err += pen(P[0], -350, -40) + pen(P[1], -200, 40);
  err += pen(F[1], 60, 420) + pen(T[1], -220, 0);
  return err;
}

// --- Nelder-Mead ------------------------------------------------------------
function nelderMead(f, x0, scale = 1, iters = 4000) {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += (i < 2 ? 30 : 0.4) * scale;
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let k = 0; k < iters; k++) {
    const order = vals.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    simplex = order.map(i => simplex[i]);
    vals = order.map(i => vals[i]);
    if (vals[0] < 1e-10) break;
    const cen = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += simplex[i][j] / n;
    const xr = cen.map((cv, j) => cv + (cv - simplex[n][j]));
    const fr = f(xr);
    if (fr < vals[0]) {
      const xe = cen.map((cv, j) => cv + 2 * (cv - simplex[n][j]));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      simplex[n] = xr; vals[n] = fr;
    } else {
      const xc = cen.map((cv, j) => cv + 0.5 * (simplex[n][j] - cv));
      const fc = f(xc);
      if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; }
      else for (let i = 1; i <= n; i++) {
        simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
        vals[i] = f(simplex[i]);
      }
    }
  }
  const best = vals.indexOf(Math.min(...vals));
  return { x: simplex[best], f: vals[best] };
}

// --- Multi-start (deterministic grid — no Math.random needed) ---------------
let best = { f: Infinity, x: null, s: 1 };
for (const s of [1, -1]) {
  for (const px of [-280, -220, -160, -100]) {
    for (const py of [-120, -60, 0]) {
      for (const th of [-150, -90, -30, 30, 90, 150]) {
        for (const phi of [0, 60, 120, 180, 240, 300]) {
          for (const psi of [60, 90, 120]) {
            const x0 = [px, py, th * D2R, phi * D2R, psi * D2R];
            const f0 = objective(x0, s);
            if (f0 >= 1e9) continue;
            const r = nelderMead(x => objective(x, s), x0, 1, 800);
            if (r.f < best.f) best = { ...r, s };
          }
        }
      }
    }
  }
}
// Polish
best = { ...nelderMead(x => objective(x, best.s), best.x, 0.2, 6000), s: best.s };

const cfg = buildCfg(best.x, best.s);
console.log('objective:', best.f.toExponential(3), ' reflection s =', best.s);
console.log('coords (rounded to 0.1 mm):');
for (const k of Object.keys(cfg)) {
  if (k === 'Linkage_Mode') continue;
  console.log(' ', k, '=', Math.round(cfg[k] * 10) / 10);
}
console.log('checks:');
console.log('  shock(0)      =', shockLength(cfg, 0).toFixed(2), '(want 283.00)');
for (const [t, want] of TARGETS) {
  const mr = motionRatio(cfg, deltaForTravel(t), L, BETA);
  console.log(`  MR(travel ${String(t).padStart(3)}) = ${mr.toFixed(3)}  (want ${want})`);
}
const stroke = shockLength(cfg, 0) - shockLength(cfg, deltaForTravel(135));
console.log('  shock stroke over 135 mm travel =', stroke.toFixed(1), 'mm');
