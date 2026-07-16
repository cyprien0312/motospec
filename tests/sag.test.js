// ============================================================
// Sag load case — the RESULTS channels are live at the measured
// suspension position (docs/superpowers/plans/2026-07-16-sag-load-case.md)
// ============================================================
//
// Contract under test:
//  1. Degeneracy — at Sag_* = 0 (and no geometry deltas) every live
//     channel equals its static value exactly. 0 means "no load applied".
//  2. Direction — front sag drops the nose (rake/trail/wheelbase down);
//     rear sag lifts it (rake up) and flattens the swingarm.
//  3. Projection pin — equal sag numbers do NOT mean unchanged attitude:
//     fork-axis travel projects to vertical via cos(Rake).
//  4. Shock-delta chain — Shock_Length − Shock_Length_ref enters the same
//     4-bar constraint as Shock_Clevis_RHA and propagates to rake,
//     ride height, and wheelbase in mutually consistent directions.
//     (Direction-level only: exact Panigale V2 pins wait for measured
//     linkage coords — see the plan's validation-fixture section.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, defaultValues, D2R, R2D } from '../src/formulas.js';

const base = () => computeAll(defaultValues());

test('degeneracy: at Sag_*=0 and zero deltas, every live channel equals its static value', () => {
  const v = defaultValues();
  const out = computeAll(v);
  assert.equal(out.Sag_Front, 0);
  assert.equal(out.Sag_Rear, 0);
  assert.equal(out.delta_fork, 0, 'default fork setup must equal the reference setup');
  assert.equal(out.swingarm_delta_solve, 0, 'default shock must equal the reference shock');
  assert.equal(out.Pitch_Sag, 0);
  assert.equal(out.delta_beta_sag, 0);
  assert.equal(out.MotoSPEC_Rake, v.Rake_Static, 'live rake must equal the measured anchor');
  assert.equal(out.MotoSPEC_Trail, out.Trail_Static, 'live trail must equal static trail');
  assert.equal(out.Swingarm_Angle, v.beta_static);
  assert.equal(out.Wheelbase_Live, v.WB);
  assert.equal(out.Rear_Ride_Height, -v.Swingarm_Length * Math.sin(v.beta_static * D2R));
});

test('direction: front sag drops the nose — rake, trail, wheelbase all decrease', () => {
  const b = base();
  const s = computeAll({ ...defaultValues(), Sag_Front: 30 });
  assert.ok(s.MotoSPEC_Rake < b.MotoSPEC_Rake, `rake ${s.MotoSPEC_Rake} should drop below ${b.MotoSPEC_Rake}`);
  assert.ok(s.MotoSPEC_Trail < b.MotoSPEC_Trail, 'trail follows rake down');
  assert.ok(s.Wheelbase_Live < b.Wheelbase_Live, 'front axle pulls back along the steering axis');
});

test('direction: rear sag lifts the nose and flattens the swingarm', () => {
  const b = base();
  const s = computeAll({ ...defaultValues(), Sag_Rear: 30 });
  assert.ok(s.MotoSPEC_Rake > b.MotoSPEC_Rake, 'rear compression pitches the chassis nose-up');
  assert.ok(s.Swingarm_Angle < b.Swingarm_Angle, 'swingarm rotates toward horizontal');
  assert.ok(s.Rear_Ride_Height > b.Rear_Ride_Height, 'axle rises toward the pivot (less negative)');
});

test('projection pin: 24° / 1400 / 30 / 30 — equal sag is a slight nose-UP pitch', () => {
  // ΔZ_front = 30·cos24° ≈ 27.406 < 30 = ΔZ_rear
  // Pitch_Sag = atan((27.406 − 30) / 1400) ≈ −0.10616°  →  rake ≈ 24.106°
  const v = { ...defaultValues(), Rake_Static: 24, WB: 1400, Sag_Front: 30, Sag_Rear: 30 };
  const out = computeAll(v);
  const expected = 24 - Math.atan((30 * Math.cos(24 * D2R) - 30) / 1400) * R2D;
  assert.ok(out.MotoSPEC_Rake > 24, 'equal sag numbers must pitch nose-up, not leave rake unchanged');
  assert.ok(Math.abs(out.MotoSPEC_Rake - expected) < 1e-9,
    `rake ${out.MotoSPEC_Rake} vs hand formula ${expected}`);
  assert.ok(Math.abs(out.MotoSPEC_Rake - 24.106) < 2e-3,
    `rake ${out.MotoSPEC_Rake} vs precomputed 24.106`);
});

test('fork delta chain: tubes up / shorter fork drop the front exactly like front sag', () => {
  const b = base();
  // Tubes raised 5 mm in the clamps
  const tubesUp = computeAll({ ...defaultValues(), Fork_Position: 10 });
  assert.equal(tubesUp.delta_fork, 5);
  assert.ok(tubesUp.MotoSPEC_Rake < b.MotoSPEC_Rake, 'raising the tubes drops the front');
  // A 10 mm shorter fork
  const shortFork = computeAll({ ...defaultValues(), Fork_Length: 760 });
  assert.equal(shortFork.delta_fork, 10);
  assert.ok(shortFork.MotoSPEC_Rake < b.MotoSPEC_Rake, 'a shorter fork drops the front');
  // Equivalence: ΔFork = x must produce the same attitude as Sag_Front = x
  const viaSag  = computeAll({ ...defaultValues(), Sag_Front: 5 });
  assert.ok(Math.abs(tubesUp.MotoSPEC_Rake - viaSag.MotoSPEC_Rake) < 1e-9,
    'ΔFork and Sag_Front must be interchangeable in the pitch chain');
});

test('shock delta chain: ΔShock is mechanically identical to RHA', () => {
  const viaRHA    = computeAll({ ...defaultValues(), Shock_Clevis_RHA: 3 });
  const viaLength = computeAll({ ...defaultValues(), Shock_Length: 313 });
  assert.ok(Number.isFinite(viaRHA.swingarm_delta_solve));
  assert.ok(Math.abs(viaRHA.swingarm_delta_solve - viaLength.swingarm_delta_solve) < 1e-9,
    'Shock_Length − Shock_Length_ref must enter the 4-bar constraint exactly like RHA');
});

test('shock delta directions: lengthening the shock raises the rear and closes rake', () => {
  const b = base();
  const longer = computeAll({ ...defaultValues(), Shock_Length: 313 });
  assert.ok(longer.swingarm_delta_solve > 0, 'longer shock pushes the swingarm down');
  assert.ok(longer.Rear_Ride_Height < b.Rear_Ride_Height, 'axle drops further below the pivot');
  assert.ok(longer.MotoSPEC_Rake < b.MotoSPEC_Rake, 'rear rises → nose-down pitch → rake closes');
  const shorter = computeAll({ ...defaultValues(), Shock_Length: 307 });
  assert.ok(shorter.swingarm_delta_solve < 0);
  assert.ok(shorter.MotoSPEC_Rake > b.MotoSPEC_Rake, 'shorter shock opens rake');
  assert.ok(shorter.Wheelbase_Live !== b.Wheelbase_Live, 'wheelbase responds to shock length');
});

test('motion ratio is evaluated at the load point, not pinned at δ=0', () => {
  const b = base();
  const s = computeAll({ ...defaultValues(), Sag_Rear: 40 });
  assert.ok(Number.isFinite(s.Motion_Ratio));
  assert.notEqual(s.Motion_Ratio, b.Motion_Ratio,
    'rear sag must move the linkage evaluation point');
  // Rear wheel rate consumes the load-point MR
  assert.ok(Math.abs(s.Rear_Wheel_Rate - s.Rear_Spring_Rate / s.Motion_Ratio ** 2) < 1e-9);
});

test('honesty: unreachable shock target still poisons the live chain to NaN', () => {
  // A shock-length delta far outside the mechanism's travel must not
  // produce a plausible rake — NaN renders as an honest "—".
  const out = computeAll({ ...defaultValues(), Shock_Length: 340, Shock_Length_ref: 190 });
  assert.ok(Number.isNaN(out.swingarm_delta_solve));
  assert.ok(Number.isNaN(out.MotoSPEC_Rake), 'rake must not survive an unreachable linkage solve');
});
