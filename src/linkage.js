// ============================================================
// 4-bar linkage closure kernel + motion-ratio helpers
// ============================================================
//
// Frame of reference: origin = swingarm pivot, +X forward, +Y up, mm.
//
// Topology (rear 4-bar):
//   Ground link: swingarm pivot (0,0) → frame rocker pivot (Px,Py).
//   Swingarm:    rotates β about (0,0); carries the drag-link end T0.
//   Drag link:   rigid bar between rocker drag attach (D) and swingarm
//                drag attach (T).
//   Rocker:      rotates Δφ about (Px,Py); carries D and the shock-end S.
//
// Closure: |frame_pivot + R(Δφ)·(D0−frame_pivot) − R(β)·T0| = L_static.

const D2R = Math.PI / 180;

export function closeFourBar(cfg, swingarmDeltaDeg) {
  const beta = swingarmDeltaDeg * D2R;
  const Px = cfg.Frame_Rocker_Pivot_X;
  const Py = cfg.Frame_Rocker_Pivot_Y;
  const Tx0 = cfg.Drag_To_Swingarm_X;
  const Ty0 = cfg.Drag_To_Swingarm_Y;
  // Rocker drag attach, expressed relative to rocker pivot
  const Dx0 = cfg.Rocker_To_Drag_X - Px;
  const Dy0 = cfg.Rocker_To_Drag_Y - Py;

  // Swingarm-side drag attach after rotation by β
  const cb = Math.cos(beta), sb = Math.sin(beta);
  const Tx = Tx0 * cb - Ty0 * sb;
  const Ty = Tx0 * sb + Ty0 * cb;

  // Static drag-link length
  const Lstatic = Math.hypot(Px + Dx0 - Tx0, Py + Dy0 - Ty0);

  let dphi = 0;
  let residual = 0;
  for (let i = 0; i < 50; i++) {
    const c = Math.cos(dphi), s = Math.sin(dphi);
    const Dx = Dx0 * c - Dy0 * s;
    const Dy = Dx0 * s + Dy0 * c;
    const dx = Px + Dx - Tx;
    const dy = Py + Dy - Ty;
    const L = Math.hypot(dx, dy);
    residual = L - Lstatic;
    if (Math.abs(residual) < 1e-9) break;
    const dDx_dphi = -Dx0 * s - Dy0 * c;
    const dDy_dphi =  Dx0 * c - Dy0 * s;
    const dL_dphi = (dx * dDx_dphi + dy * dDy_dphi) / L;
    if (Math.abs(dL_dphi) < 1e-12) break; // singular
    dphi -= residual / dL_dphi;
  }

  const phiStaticDeg = Math.atan2(Dy0, Dx0) / D2R;
  return {
    rockerAngleDeg: phiStaticDeg + dphi / D2R,
    deltaPhiDeg: dphi / D2R,
    residual,
  };
}

// Position of the rocker's shock attachment after swingarm rotation
export function rockerShockEnd(cfg, swingarmDeltaDeg) {
  const Px = cfg.Frame_Rocker_Pivot_X;
  const Py = cfg.Frame_Rocker_Pivot_Y;
  const Sx0 = cfg.Rocker_To_Shock_X - Px;
  const Sy0 = cfg.Rocker_To_Shock_Y - Py;
  const { deltaPhiDeg } = closeFourBar(cfg, swingarmDeltaDeg);
  const c = Math.cos(deltaPhiDeg * D2R);
  const s = Math.sin(deltaPhiDeg * D2R);
  return { x: Px + Sx0 * c - Sy0 * s, y: Py + Sx0 * s + Sy0 * c };
}

export function shockLength(cfg, swingarmDeltaDeg) {
  const e = rockerShockEnd(cfg, swingarmDeltaDeg);
  return Math.hypot(e.x - cfg.Frame_Shock_Top_X, e.y - cfg.Frame_Shock_Top_Y);
}

// Rear wheel y-coordinate (positive down) relative to swingarm pivot.
// betaStaticDeg is the static swingarm angle below horizontal (+ve number,
// matches CSV input convention; e.g. R7 ≈ 14°).
export function rearWheelHeight(cfg, swingarmDeltaDeg, swingarmLength, betaStaticDeg) {
  const totalDeg = betaStaticDeg + swingarmDeltaDeg;
  // wheel sits below pivot by swingarmLength·sin(angle below horizontal)
  return swingarmLength * Math.sin(totalDeg * D2R);
}

// Motion ratio (rear-wheel travel / shock travel), centred-difference at swingarmDeltaDeg.
export function motionRatio(cfg, swingarmDeltaDeg, swingarmLength, betaStaticDeg) {
  const eps = 0.5; // degrees
  const yPlus  = rearWheelHeight(cfg, swingarmDeltaDeg + eps, swingarmLength, betaStaticDeg);
  const yMinus = rearWheelHeight(cfg, swingarmDeltaDeg - eps, swingarmLength, betaStaticDeg);
  const sPlus  = shockLength(cfg, swingarmDeltaDeg + eps);
  const sMinus = shockLength(cfg, swingarmDeltaDeg - eps);
  const ds = sPlus - sMinus;
  if (Math.abs(ds) < 1e-9) return NaN;
  return Math.abs((yPlus - yMinus) / ds);
}

// Progression % over the working travel range.
export function progression(cfg, swingarmLength, betaStaticDeg, fullBumpDeltaDeg = 25) {
  const samples = 9;
  let minMR = Infinity, maxMR = -Infinity;
  for (let i = 0; i < samples; i++) {
    const delta = (i / (samples - 1)) * fullBumpDeltaDeg;
    const mr = motionRatio(cfg, delta, swingarmLength, betaStaticDeg);
    if (!Number.isFinite(mr)) continue;
    if (mr < minMR) minMR = mr;
    if (mr > maxMR) maxMR = mr;
  }
  if (!Number.isFinite(minMR) || !Number.isFinite(maxMR) || minMR === 0) return NaN;
  return (maxMR - minMR) / minMR * 100;
}

// Given a measured shock displacement (mm shorter than static), find Δβ.
export function swingarmDeltaForShockTravel(cfg, shockTravel) {
  const Lstatic = shockLength(cfg, 0);
  const target = Lstatic - shockTravel; // shock shortens on bump
  let lo = -45, hi = 45;
  let fLo = shockLength(cfg, lo) - target;
  let fHi = shockLength(cfg, hi) - target;
  if (fLo * fHi > 0) {
    return Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
  }
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = shockLength(cfg, mid) - target;
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; }
    else                { lo = mid; fLo = fMid; }
  }
  return 0.5 * (lo + hi);
}

// Rear vertical wheel travel given a measured shock displacement.
export function rearVerticalTravel(cfg, shockTravel, swingarmLength, betaStaticDeg) {
  const delta = swingarmDeltaForShockTravel(cfg, shockTravel);
  const yNow    = rearWheelHeight(cfg, delta, swingarmLength, betaStaticDeg);
  const yStatic = rearWheelHeight(cfg, 0,     swingarmLength, betaStaticDeg);
  return Math.abs(yNow - yStatic);
}

// Rear ride height: signed negative chassis-to-axle reference (axle below pivot).
export function rearRideHeight(cfg, shockTravel, swingarmLength, betaStaticDeg) {
  const delta = swingarmDeltaForShockTravel(cfg, shockTravel);
  return -rearWheelHeight(cfg, delta, swingarmLength, betaStaticDeg);
}
