// ============================================================
// Tire radius delta chain — Tire_Rf_Delta / Tire_Rr_Delta
// ============================================================
//
// A tire swap changes attitude two ways: the direct trail term (the live
// front radius is Rf + Δ) and the pitch term (a taller tire raises that
// end of the bike). Both are modeled; at Δ = 0 everything degenerates
// exactly to the baseline (0 = same tire, physically true — same contract
// as Fork_Length_Delta). There is no MotoSPEC oracle column for a tire
// change, so these are geometry pins, not oracle pins.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, defaultValues, INPUT_META } from '../src/formulas.js';
import { ALWAYS_READY } from '../src/data-table.js';
import CHASSIS from '../data/chassis.json' with { type: 'json' };
import LINKAGES from '../data/linkages.json' with { type: 'json' };
import SHOCKS from '../data/shocks.json' with { type: 'json' };
import FORKS from '../data/forks.json' with { type: 'json' };

const D2R = Math.PI / 180;

const inputs = () => ({ ...defaultValues(),
  ...CHASSIS['street-triple-rs-765-2020'].specs,
  ...FORKS['showa-bpf-765'].specs,
  ...SHOCKS['ohlins-stx40-765'].specs,
  ...LINKAGES['triumph-765-stock-fit'].specs });

test('tire deltas default to 0 and are ALWAYS_READY', () => {
  assert.equal(INPUT_META.Tire_Rf_Delta.def, 0);
  assert.equal(INPUT_META.Tire_Rr_Delta.def, 0);
  assert.ok(ALWAYS_READY.has('Tire_Rf_Delta'));
  assert.ok(ALWAYS_READY.has('Tire_Rr_Delta'));
});

test('zero tire deltas degenerate exactly to the baseline', () => {
  const base = computeAll(inputs());
  const zero = computeAll({ ...inputs(), Tire_Rf_Delta: 0, Tire_Rr_Delta: 0 });
  for (const ch of ['MotoSPEC_Rake', 'MotoSPEC_Trail', 'Normal_Trail', 'Swingarm_Angle', 'Rear_Ride_Height', 'Wheelbase_Live']) {
    assert.equal(zero[ch], base[ch], `${ch} must be bit-identical at zero deltas`);
  }
});

test('taller front tire: front rises, rake opens, trail grows (both terms)', () => {
  const base = computeAll(inputs());
  const out = computeAll({ ...inputs(), Tire_Rf_Delta: 5 });
  // Pitch term: nose up by exactly atan(5 / WB).
  const expectedRake = base.MotoSPEC_Rake + Math.atan(5 / 1414.3) / D2R;
  assert.ok(Math.abs(out.MotoSPEC_Rake - expectedRake) < 1e-9,
    `rake ${out.MotoSPEC_Rake} vs expected ${expectedRake}`);
  // Trail: closed form at the new rake with the live radius Rf + 5.
  const r = out.MotoSPEC_Rake * D2R;
  const expectedTrail = ((304.6 + 5) * Math.sin(r) - 26) / Math.cos(r);
  assert.ok(Math.abs(out.MotoSPEC_Trail - expectedTrail) < 1e-9);
  assert.ok(out.MotoSPEC_Trail > base.MotoSPEC_Trail, 'taller front tire must add trail');
});

test('taller rear tire: rear rises, rake closes, trail shrinks', () => {
  const base = computeAll(inputs());
  const out = computeAll({ ...inputs(), Tire_Rr_Delta: 5 });
  const expectedRake = base.MotoSPEC_Rake - Math.atan(5 / 1414.3) / D2R;
  assert.ok(Math.abs(out.MotoSPEC_Rake - expectedRake) < 1e-9);
  assert.ok(out.MotoSPEC_Trail < base.MotoSPEC_Trail, 'taller rear tire must cut trail');
  // The rear mechanism is untouched — a tire is not a linkage change.
  assert.equal(out.Rear_Ride_Height, base.Rear_Ride_Height);
  assert.equal(out.Motion_Ratio, base.Motion_Ratio);
});

test('equal front and rear deltas cancel the pitch but keep the trail radius term', () => {
  const base = computeAll(inputs());
  const out = computeAll({ ...inputs(), Tire_Rf_Delta: 4, Tire_Rr_Delta: 4 });
  assert.ok(Math.abs(out.MotoSPEC_Rake - base.MotoSPEC_Rake) < 1e-9,
    'same-height tire change front+rear must not pitch the bike');
  const r = base.MotoSPEC_Rake * D2R;
  const expectedTrail = ((304.6 + 4) * Math.sin(r) - 26) / Math.cos(r);
  assert.ok(Math.abs(out.MotoSPEC_Trail - expectedTrail) < 1e-9,
    'trail must still see the bigger front radius');
});
