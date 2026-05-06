import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeFourBar } from '../src/linkage.js';

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
