import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeFourBar,
  shockLength,
  swingarmDeltaForShockTravel,
  rearVerticalTravel,
  rearRideHeight,
} from '../src/linkage.js';

test('4-bar closure: residual is zero at static configuration', () => {
  const cfg = {
    Frame_Rocker_Pivot_X: -100, Frame_Rocker_Pivot_Y: 100,
    Rocker_To_Drag_X: -50,      Rocker_To_Drag_Y: 50,
    Drag_To_Swingarm_X: 50,     Drag_To_Swingarm_Y: 0,
  };
  const { residual } = closeFourBar(cfg, 0);
  assert.ok(Math.abs(residual) < 1e-6, `residual ${residual}`);
});

test('4-bar closure is continuous under small swingarm rotation', () => {
  const cfg = {
    Frame_Rocker_Pivot_X: -100, Frame_Rocker_Pivot_Y: 100,
    Rocker_To_Drag_X: -50,      Rocker_To_Drag_Y: 50,
    Drag_To_Swingarm_X: 50,     Drag_To_Swingarm_Y: 0,
  };
  const a = closeFourBar(cfg, 0).deltaPhiDeg;
  const b = closeFourBar(cfg, 1).deltaPhiDeg;
  assert.ok(Math.abs(a - b) < 5, `discontinuity: 0deg→${a}, 1deg→${b}`);
});

const SYNTHETIC = {
  Frame_Rocker_Pivot_X: -100, Frame_Rocker_Pivot_Y: 100,
  Rocker_To_Shock_X:    -120, Rocker_To_Shock_Y:    140,
  Rocker_To_Drag_X:     -50,  Rocker_To_Drag_Y:     50,
  Drag_To_Swingarm_X:    50,  Drag_To_Swingarm_Y:   0,
  Frame_Shock_Top_X:    -250, Frame_Shock_Top_Y:    320,
};

test('swingarmDeltaForShockTravel inverts shockLength on bump', () => {
  const Lstatic = shockLength(SYNTHETIC, 0);
  // Drive swingarm by +10° → some shock length L1, then ask for the Δ that
  // yields exactly that length. Bisection should land back near +10°.
  const ref = 10;
  const Lref = shockLength(SYNTHETIC, ref);
  const travel = Lstatic - Lref;
  const delta = swingarmDeltaForShockTravel(SYNTHETIC, travel);
  assert.ok(Math.abs(delta - ref) < 0.05, `got ${delta}, expected ${ref}`);
});

test('rearVerticalTravel is zero at zero shock travel', () => {
  const t = rearVerticalTravel(SYNTHETIC, 0, 580, 14);
  assert.ok(Math.abs(t) < 1e-3, `got ${t}`);
});

test('rearRideHeight is signed negative for swingarm below pivot', () => {
  const h = rearRideHeight(SYNTHETIC, 0, 580, 14);
  assert.ok(h < 0, `expected axle below pivot, got ${h}`);
});

test('pro-link mode: closure residual zero at static (β=0)', () => {
  const cfg = { ...SYNTHETIC, Linkage_Mode: 'pro-link' };
  const { residual } = closeFourBar(cfg, 0);
  assert.ok(Math.abs(residual) < 1e-6, `residual ${residual}`);
});

test('pro-link mode: closure is continuous under small swingarm rotation', () => {
  const cfg = { ...SYNTHETIC, Linkage_Mode: 'pro-link' };
  const a = closeFourBar(cfg, 0).deltaPhiDeg;
  const b = closeFourBar(cfg, 1).deltaPhiDeg;
  assert.ok(Math.abs(a - b) < 5, `discontinuity: 0deg→${a}, 1deg→${b}`);
});

test('pro-link vs linked: kinematics differ for non-zero swingarm rotation', () => {
  const cfgLinked = { ...SYNTHETIC, Linkage_Mode: 'linked' };
  const cfgPro    = { ...SYNTHETIC, Linkage_Mode: 'pro-link' };
  // At β=0 both modes share the static config so shock length must match.
  assert.ok(Math.abs(shockLength(cfgLinked, 0) - shockLength(cfgPro, 0)) < 1e-6);
  // Under β=3° both modes still close (SYNTHETIC is a linked-mode fixture
  // and locks in pro-link past ~4°) and must produce different shock
  // lengths — otherwise the mode dispatch is a no-op.
  const dL = shockLength(cfgLinked, 3) - shockLength(cfgPro, 3);
  assert.ok(Number.isFinite(dL), 'both modes must converge at 3°');
  assert.ok(Math.abs(dL) > 0.1, `expected modes to differ, got Δ=${dL}`);
});

test('impossible closure yields NaN, not a fake number', () => {
  // SYNTHETIC in pro-link mode has NO closure solution at β=10° (the drag
  // link would need to stretch ~90 mm; verified by full-circle scan of the
  // closure residual). The solver used to return an unconverged Newton
  // iterate here — it must poison the result instead.
  const cfgPro = { ...SYNTHETIC, Linkage_Mode: 'pro-link' };
  assert.ok(Number.isNaN(shockLength(cfgPro, 10)),
    'unconverged closure must return NaN');
});

test('unreachable shock-length target yields NaN, not a ±45° endpoint', () => {
  // Ask for a shock 500 mm shorter than static — no swingarm angle within
  // ±45° achieves that. The old code returned the nearer endpoint (±45°),
  // presenting a wild swingarm rotation as a real solution.
  const delta = swingarmDeltaForShockTravel(SYNTHETIC, 500);
  assert.ok(Number.isNaN(delta), `expected NaN, got ${delta}`);
});
