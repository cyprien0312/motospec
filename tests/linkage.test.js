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
