// ============================================================
// Spring Center, acceleration limits and stroke percentages
// ============================================================
//
// Four RESULTS channels ported from real MotoSPEC (see
// docs/research/motospec-v5-teardown.md §2.1–2.2, §2.6). Everything here
// is closed-form on values we already carry, so the tests pin the
// identities exactly rather than eyeballing plausible ranges.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, defaultValues, INPUT_META, P } from '../src/formulas.js';

const base = () => defaultValues();

test('Spring Center is the rear share of total wheel rate', () => {
  const out = computeAll(base());
  const expected = out.Rear_Wheel_Rate / (out.Front_Wheel_Rate + out.Rear_Wheel_Rate);
  assert.ok(Number.isFinite(out.Spring_Center));
  assert.ok(Math.abs(out.Spring_Center - expected) < 1e-12);
  assert.ok(out.Spring_Center > 0 && out.Spring_Center < 1);
});

test('Spring Center = 0.5 exactly when both ends carry the same wheel rate', () => {
  // Solve the front spring rate that makes the front wheel rate equal the
  // rear one, then assert the split lands dead centre.
  const v = base();
  const out0 = computeAll({ ...v });
  const MRf2 = 1 / Math.cos(v.Rake_Static * Math.PI / 180) ** 2;
  v.Front_Spring_Rate = out0.Rear_Wheel_Rate / (2 * MRf2);
  const out = computeAll(v);
  assert.ok(Math.abs(out.Front_Wheel_Rate - out.Rear_Wheel_Rate) < 1e-9);
  assert.ok(Math.abs(out.Spring_Center - 0.5) < 1e-12);
});

test('Spring Center is NaN when a wheel rate cannot be computed', () => {
  const v = base();
  v.Rear_Spring_Rate = NaN;
  assert.ok(Number.isNaN(computeAll(v).Spring_Center));
});

test('acceleration limits: front lifts at L_CG/H_CG, rear at (WB−L_CG)/H_CG', () => {
  const v = { ...base(), H_CG: 650, L_CG: 750, WB: 1400 };
  const out = computeAll(v);
  assert.ok(Math.abs(out.Wheelie_Limit - 750 / 650) < 1e-12);
  assert.ok(Math.abs(out.Braking_Limit - (1400 - 750) / 650) < 1e-12);
});

test('acceleration limits: the wheelbase cancels out of the wheelie limit', () => {
  // Front share = L_CG/WB, transferred share = a·H_CG/WB — same denominator.
  const a = computeAll({ ...base(), H_CG: 640, L_CG: 700, WB: 1400 }).Wheelie_Limit;
  const b = computeAll({ ...base(), H_CG: 640, L_CG: 700, WB: 1500 }).Wheelie_Limit;
  assert.equal(a, b);
});

test('acceleration limits: a taller CG lowers both limits', () => {
  const low  = computeAll({ ...base(), H_CG: 600, L_CG: 750, WB: 1400 });
  const high = computeAll({ ...base(), H_CG: 700, L_CG: 750, WB: 1400 });
  assert.ok(high.Wheelie_Limit < low.Wheelie_Limit);
  assert.ok(high.Braking_Limit < low.Braking_Limit);
});

test('acceleration limits are NaN without a measured CG (no fake number)', () => {
  const v = base();
  delete v.H_CG;
  delete v.L_CG;
  const out = computeAll(v);
  assert.ok(Number.isNaN(out.Wheelie_Limit));
  assert.ok(Number.isNaN(out.Braking_Limit));
  // A zero/negative CG height would divide by zero — guard, don't emit ±∞.
  assert.ok(Number.isNaN(computeAll({ ...base(), H_CG: 0 }).Wheelie_Limit));
});

test('front stroke %: sag over fork stroke, in the same (fork-axis) units', () => {
  const out = computeAll({ ...base(), Sag_Front: 35, Fork_Stroke: 130 });
  assert.ok(Math.abs(out.Front_Stroke_Pct - 35 / 130 * 100) < 1e-12);
  // The manual's own worked example: 35 mm on a 130 mm fork ≈ 27%.
  assert.ok(Math.abs(out.Front_Stroke_Pct - 26.92) < 0.01);
});

test('front stroke %: zero sag is exactly 0, unknown stroke is NaN', () => {
  assert.equal(computeAll({ ...base(), Sag_Front: 0, Fork_Stroke: 120 }).Front_Stroke_Pct, 0);
  assert.ok(Number.isNaN(computeAll({ ...base(), Sag_Front: 30, Fork_Stroke: 0 }).Front_Stroke_Pct));
});

test('rear stroke %: unloaded state is exactly 0 (not a rounding artefact)', () => {
  const out = computeAll({ ...base(), Sag_Rear: 0 });
  assert.equal(out.Shock_Travel_Live, 0);
  assert.equal(out.Rear_Stroke_Pct, 0);
});

test('rear stroke %: rear sag compresses the shock, monotonically', () => {
  const a = computeAll({ ...base(), Sag_Rear: 20 });
  const b = computeAll({ ...base(), Sag_Rear: 40 });
  assert.ok(a.Shock_Travel_Live > 0, 'compression must be positive');
  assert.ok(b.Shock_Travel_Live > a.Shock_Travel_Live);
  assert.ok(b.Rear_Stroke_Pct > a.Rear_Stroke_Pct);
});

test('rear stroke %: shock travel is the 4-bar solve, not wheel travel ÷ motion ratio', () => {
  // The linear approximation is close but not equal on a progressive
  // linkage — if these ever coincide to machine precision, the exact
  // solve has been quietly replaced by the shortcut.
  const v = { ...base(), Sag_Rear: 40 };
  const out = computeAll(v);
  const linear = v.Sag_Rear / out.Motion_Ratio;
  assert.ok(Math.abs(out.Shock_Travel_Live - linear) > 1e-9);
  assert.ok(Math.abs(out.Shock_Travel_Live - linear) < 3, 'but it should stay in the same ballpark');
});

test('stroke % pair uses component-level units at BOTH ends (front/rear comparable)', () => {
  // Rear sag is measured vertically at the wheel; the % must go through
  // the linkage rather than dividing wheel sag by the shock stroke.
  const v = { ...base(), Sag_Rear: 40, Shock_Stroke: 60 };
  const out = computeAll(v);
  const naive = 40 / 60 * 100;
  assert.ok(out.Rear_Stroke_Pct < naive / 1.5,
    'rear % must reflect shock travel (~sag/MR), not raw wheel sag over shock stroke');
});

test('Fork_Stroke is declared as an input with a real-world range', () => {
  assert.equal(P.Fork_Stroke.type, 'input');
  const m = INPUT_META.Fork_Stroke;
  assert.ok(m.min <= 110 && m.max >= 300, 'range must cover road racing through motocross');
});

test('setup steps match the real MotoSPEC adjustment increments', () => {
  // These are what one spinner click should do at the track — taken from
  // the PageUp/PageDown table in the v5 manual.
  const expected = {
    Yoke_Offset: 1, Fork_Position: 1, Swingarm_Length: 1, Shock_Length: 0.5,
    Shock_Clevis_RHA: 0.5, Front_Spring_Rate: 0.5, Front_Spring_Preload: 0.5,
    Front_Oil_Level: 5, Front_Topout_Rate: 0.5, Front_Topout_Length: 5,
    Rear_Spring_Rate: 2.5, Rear_Spring_Preload: 0.5, Rear_Topout_Rate: 10,
    Rear_Topout_Length: 1, Front_Sprocket: 1, Rear_Sprocket: 1, Lean_Angle: 5,
  };
  for (const [k, step] of Object.entries(expected)) {
    assert.equal(INPUT_META[k].step, step, `${k} step should be the track adjustment increment`);
  }
  // The *_ref baselines are MEASURED, not dialled — they keep finer steps.
  assert.ok(INPUT_META.Swingarm_Length_ref.step < INPUT_META.Swingarm_Length.step);
  assert.ok(INPUT_META.Shock_Length_ref.step < INPUT_META.Shock_Length.step);
});

test('adding the new channels left the static degeneracy intact', () => {
  // Unloaded, zero-delta state must still reduce exactly to static.
  const out = computeAll(base());
  assert.equal(out.Shock_Travel_Live, 0);
  assert.equal(out.Rear_Stroke_Pct, 0);
  assert.equal(out.Front_Stroke_Pct, 0);
  assert.ok(Math.abs(out.MotoSPEC_Rake - out.Rake_Static) < 1e-12);
});
