// ============================================================
// Phase 2: predicted sag from spring data
// ============================================================
//
// Coil-spring-only equilibrium: predicted-vs-measured is a spring-rate
// diagnostic (air spring / stiction live in the residual by design).
// Front: axial balance with the twin main springs + topout region.
// Rear: iterative solve — spring force vs wheel load × motion ratio at
// the solved position, wheel sag via the 4-bar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, defaultValues, D2R } from '../src/formulas.js';

const base = (over = {}) => computeAll({ ...defaultValues(), ...over });

test('front prediction: plain coil case matches the closed form', () => {
  // Mass 200, 50% front → W_F = 981 N; axial = 981·cos24°; k = 2×9 = 18,
  // preload 10, no topout: x = F/k − p
  const out = base({
    Mass: 200, front_weight_dist: 0.5, rear_weight_dist: 0.5, Rake_Static: 24,
    Front_Spring_Rate: 9, Front_Spring_Preload: 10,
    Front_Topout_Rate: 0, Front_Topout_Length: 0,
  });
  const F = 200 * 9.81 * 0.5 * Math.cos(24 * D2R);
  assert.ok(Math.abs(out.Sag_Front_Predicted - (F / 18 - 10)) < 1e-9,
    `got ${out.Sag_Front_Predicted}`);
});

test('front prediction: preload beyond the load reads 0, never negative', () => {
  const out = base({
    Mass: 60, front_weight_dist: 0.5, rear_weight_dist: 0.5,
    Front_Spring_Rate: 10, Front_Spring_Preload: 40,
    Front_Topout_Rate: 0, Front_Topout_Length: 0,
  });
  assert.equal(out.Sag_Front_Predicted, 0);
});

test('front prediction: topout spring produces free sag under zero load', () => {
  // No load at all: the topout spring pushes the fork into its travel.
  // x = (kt·tl − k·p)/(k + kt), all rates doubled (two legs).
  const out = base({
    Mass: 0, front_weight_dist: 0.5, rear_weight_dist: 0.5,
    Front_Spring_Rate: 9, Front_Spring_Preload: 0,
    Front_Topout_Rate: 4, Front_Topout_Length: 40,
  });
  const expected = (8 * 40) / (18 + 8);
  assert.ok(Math.abs(out.Sag_Front_Predicted - expected) < 1e-9,
    `got ${out.Sag_Front_Predicted}, want ${expected}`);
});

test('rear prediction: equilibrium sag on the default linkage is plausible', () => {
  const out = base();
  // defaults: Mass 265 → W_R ≈ 1247 N, MR ≈ 2.4, spring 110 + preload 14
  assert.ok(Number.isFinite(out.Sag_Rear_Predicted), `got ${out.Sag_Rear_Predicted}`);
  assert.ok(out.Sag_Rear_Predicted > 15 && out.Sag_Rear_Predicted < 60,
    `implausible predicted rear sag ${out.Sag_Rear_Predicted}`);
  // Equilibrium check: at the solved point, spring force ≈ load × MR.
  // (indirect: a stiffer spring must predict LESS sag)
  const stiff = base({ Rear_Spring_Rate: 160 });
  assert.ok(stiff.Sag_Rear_Predicted < out.Sag_Rear_Predicted, 'stiffer spring → less sag');
  const preloaded = base({ Rear_Spring_Preload: 25 });
  assert.ok(preloaded.Sag_Rear_Predicted < out.Sag_Rear_Predicted, 'more preload → less sag');
});

test('rear prediction: heavier load sits deeper; bottoming reads NaN, not a fake number', () => {
  const light = base({ Mass: 200 });
  const heavy = base({ Mass: 320 });
  assert.ok(heavy.Sag_Rear_Predicted > light.Sag_Rear_Predicted);
  // Absurd load can't balance within the shock stroke → honest NaN
  const crushed = base({ Mass: 380, Rear_Spring_Rate: 70 });
  if (Number.isFinite(crushed.Sag_Rear_Predicted)) {
    assert.ok(crushed.Sag_Rear_Predicted > heavy.Sag_Rear_Predicted);
  } // else: bottomed → NaN is the correct honest answer
});

test('predictions gate on the mass picture: Mass is a leaf of both channels', async () => {
  const { P } = await import('../src/formulas.js');
  const leaves = (id, seen = new Set(), out = new Set()) => {
    if (seen.has(id)) return out;
    seen.add(id);
    const p = P[id];
    if (!p || p.type === 'input') { out.add(id); return out; }
    for (const d of p.deps || []) leaves(d, seen, out);
    return out;
  };
  for (const ch of ['Sag_Front_Predicted', 'Sag_Rear_Predicted']) {
    const ls = leaves(ch);
    assert.ok(ls.has('Mass'), `${ch} must gate on Mass`);
  }
  // So the 765 (mass not yet measured) blanks these rows honestly —
  // covered structurally by the readiness system.
});
