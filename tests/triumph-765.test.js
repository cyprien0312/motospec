// ============================================================
// Oracle parity: Triumph Street Triple RS 765 (2020)
// ============================================================
//
// Pins our channels against real MotoSPEC PRO output (screenshots
// 2026-07-16, transcribed in docs/research/triumph-765-motospec.md).
// The linkage coords are a fitted equivalence-class member (known link
// dimensions placed to reproduce the oracle's motion-ratio curve), so the
// MR/progression pins are regression pins of the fit, while the
// trail/ride-height/wheelbase pins are genuinely independent checks of
// our formulas against the oracle's closed-form ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, defaultValues } from '../src/formulas.js';
import { progression, motionRatio } from '../src/linkage.js';
import CHASSIS from '../data/chassis.json' with { type: 'json' };
import LINKAGES from '../data/linkages.json' with { type: 'json' };
import SHOCKS from '../data/shocks.json' with { type: 'json' };
import FORKS from '../data/forks.json' with { type: 'json' };

const chassis = CHASSIS['street-triple-rs-765-2020'].specs;
const linkage = LINKAGES['triumph-765-stock-fit'].specs;
const shock   = SHOCKS['ohlins-stx40-765'].specs;
const fork    = FORKS['showa-bpf-765'].specs;

const inputs = () => ({ ...defaultValues(), ...chassis, ...fork, ...shock, ...linkage });

// Full wheel travel per the oracle chart: 135 mm vertical at the axle
// → swingarm sweeps 12.23° down to −0.88°, i.e. 13.11° of bump.
const FULL_TRAVEL_DEG = 13.11;

test('765 oracle: trail chain matches exactly (closed-form check)', () => {
  const out = computeAll(inputs());
  assert.ok(Math.abs(out.MotoSPEC_Rake - 23.7) < 1e-9, `rake ${out.MotoSPEC_Rake}`);
  assert.ok(Math.abs(out.MotoSPEC_Trail - 105.3) < 0.1, `ground trail ${out.MotoSPEC_Trail} vs 105.3`);
  assert.ok(Math.abs(out.Normal_Trail - 96.4) < 0.1, `normal trail ${out.Normal_Trail} vs 96.4`);
});

test('765 oracle: yoke-offset columns 27.5 / 29.0 reproduce the trail deltas', () => {
  // The oracle's rake shifts a hair with offset (23.7→23.66) because its
  // absolute frame model sees the front-height change; ours holds
  // Rake_Static (measured anchor), which costs ≤ 0.35 mm of trail here
  // (at THEIR rake 23.66, our formula gives their 101.7 exactly).
  const c2 = computeAll({ ...inputs(), Yoke_Offset: 27.5 });
  assert.ok(Math.abs(c2.MotoSPEC_Trail - 103.5) < 0.4, `col2 trail ${c2.MotoSPEC_Trail} vs 103.5`);
  const c3 = computeAll({ ...inputs(), Yoke_Offset: 29.0 });
  assert.ok(Math.abs(c3.MotoSPEC_Trail - 101.7) < 0.4, `col3 trail ${c3.MotoSPEC_Trail} vs 101.7`);
  // Wheelbase responds to yoke offset via Δo·cos(Rake) — the oracle's own
  // columns: 1414.3 → 1415.7 → 1417.
  assert.ok(Math.abs(c2.Wheelbase_Live - 1415.7) < 0.15, `col2 WB ${c2.Wheelbase_Live} vs 1415.7`);
  assert.ok(Math.abs(c3.Wheelbase_Live - 1417.0) < 0.15, `col3 WB ${c3.Wheelbase_Live} vs 1417`);
});

test('765 oracle: chain-adjuster axle move flows into wheelbase and attitude', () => {
  // Axle +5 mm along the swingarm: WB is NOT hand-edited — Wheelbase_Live
  // gains ≈ 5·cos(12.23°) = 4.89 mm; the axle sits 5·sin(12.23°) ≈ 1.06 mm
  // deeper below the pivot, so the rear lifts → rake closes a hair.
  const b = computeAll(inputs());
  const m = computeAll({ ...inputs(), Swingarm_Length: 599.5 });
  assert.ok(Math.abs((m.Wheelbase_Live - b.Wheelbase_Live) - 5 * Math.cos(12.23 * Math.PI / 180)) < 0.01,
    `ΔWB ${m.Wheelbase_Live - b.Wheelbase_Live}`);
  assert.ok(m.MotoSPEC_Rake < b.MotoSPEC_Rake, 'longer swingarm lifts the rear → rake closes');
  assert.ok(m.Rear_Ride_Height < b.Rear_Ride_Height, 'axle deeper below the pivot');
});

test('765 oracle: rear ride height and swingarm angle', () => {
  const out = computeAll(inputs());
  // Their convention: signed to-ground −12.2; ours: positive below horizontal.
  assert.ok(Math.abs(out.Swingarm_Angle - 12.23) < 0.05, `swingarm ${out.Swingarm_Angle}`);
  assert.ok(Math.abs(out.Rear_Ride_Height - (-125.9)) < 0.15, `RRH ${out.Rear_Ride_Height} vs −125.9`);
});

test('765 oracle: motion ratio 2.458 static, 1.956 at full travel', () => {
  const out = computeAll(inputs());
  assert.ok(Math.abs(out.Motion_Ratio - 2.458) < 0.005, `MR ${out.Motion_Ratio} vs 2.458`);
  const mrFull = motionRatio(inputs(), -FULL_TRAVEL_DEG, 594.5, 12.23);
  assert.ok(Math.abs(mrFull - 1.956) < 0.01, `MR@full ${mrFull} vs 1.956`);
});

test('765 oracle: progression 25.6% over full travel (bump sweep)', () => {
  // Confirms the bump-direction progression sweep: the oracle quotes 25.6%
  // over full shock travel; the droop-side sweep would give ~39%.
  const p = progression(inputs(), 594.5, 12.23, FULL_TRAVEL_DEG);
  assert.ok(Math.abs(p - 25.6) < 0.5, `progression ${p} vs 25.6`);
});

test('765 oracle: wheelbase and wheel rate (documented model differences)', () => {
  const out = computeAll(inputs());
  // Unloaded, zero deltas → Wheelbase_Live must equal the WB input, which
  // is the oracle's computed wheelbase at this state.
  assert.ok(Math.abs(out.Wheelbase_Live - 1414.3) < 1e-9);
  // Known difference: the oracle's rear wheel rate 47.54 ≈ (100+188)/MR²
  // includes the topout spring in parallel at zero compression; ours is
  // main-spring only → 100/2.458² ≈ 16.55.
  assert.ok(Math.abs(out.Rear_Wheel_Rate - 100 / out.Motion_Ratio ** 2) < 1e-9);
  assert.ok(Math.abs(out.Rear_Wheel_Rate - 16.55) < 0.05, `RWR ${out.Rear_Wheel_Rate}`);
});

test('765 oracle: fitted link dimensions are preserved exactly', () => {
  // The fit's hard constraints — the physically measured lengths from the
  // LINK DIMENSIONS dialog must survive any future coordinate edits.
  const d = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const l = linkage;
  const P = [l.Frame_Rocker_Pivot_X, l.Frame_Rocker_Pivot_Y];
  const S = [l.Rocker_To_Shock_X, l.Rocker_To_Shock_Y];
  const D = [l.Rocker_To_Drag_X, l.Rocker_To_Drag_Y];
  const T = [l.Drag_To_Swingarm_X, l.Drag_To_Swingarm_Y];
  assert.ok(Math.abs(d(...P, ...S) - 77.70) < 0.15, 'swingarm–shock 77.70');
  assert.ok(Math.abs(d(...P, ...D) - 45.30) < 0.15, 'swingarm–linkarm 45.30');
  assert.ok(Math.abs(d(...S, ...D) - 57.65) < 0.15, 'shock–linkarm 57.65');
  assert.ok(Math.abs(d(...D, ...T) - 169.20) < 0.15, 'linkarm length 169.20');
});
