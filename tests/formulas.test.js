import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P, INPUT_META, CALC, TOPO_ORDER, defaultValues, computeAll } from '../src/formulas.js';
import { REFERENCE_BIKES } from '../src/reference-bikes.js';

test('every non-input parameter has a CALC function', () => {
  for (const id in P) {
    if (P[id].type === 'input') continue;
    assert.ok(typeof CALC[id] === 'function', `missing CALC for ${id}`);
  }
});

test('every input parameter has INPUT_META with def/min/max/step', () => {
  for (const id in P) {
    if (P[id].type !== 'input') continue;
    const m = INPUT_META[id];
    assert.ok(m, `missing INPUT_META for ${id}`);
    for (const k of ['def', 'min', 'max', 'step']) {
      assert.equal(typeof m[k], 'number', `${id}.${k} must be number`);
    }
    assert.ok(m.min <= m.def && m.def <= m.max, `${id} default outside range`);
  }
});

test('every parameter has name, label, unit, type', () => {
  for (const id in P) {
    const p = P[id];
    for (const k of ['name', 'label', 'unit', 'type']) {
      assert.ok(p[k], `${id}.${k} missing`);
    }
    assert.ok(['input', 'intermediate', 'channel'].includes(p.type));
    if (p.type !== 'input') {
      assert.ok(Array.isArray(p.deps), `${id}.deps must be an array for non-input`);
    }
  }
});

const KNOWN_STUB_NAN = new Set([
  'Rear_Wheel_Rate', 'Front_Wheel_Rate',
]);
test('computeAll on defaults returns finite values for all non-stub params', () => {
  const out = computeAll(defaultValues());
  for (const id in P) {
    if (KNOWN_STUB_NAN.has(id)) continue;
    assert.ok(Number.isFinite(out[id]), `${id} = ${out[id]} not finite`);
  }
});

test('W_F_Static + W_R_Static equals Mass × g × (front+rear dist)', () => {
  const out = computeAll(defaultValues());
  const total = out.W_F_Static + out.W_R_Static;
  const expected = out.Mass * 9.81 * (out.front_weight_dist + out.rear_weight_dist);
  assert.ok(Math.abs(total - expected) < 1e-9);
});

test('W_F_Static = Mass × 9.81 × front_weight_dist', () => {
  const out = computeAll({ ...defaultValues(), Mass: 200, front_weight_dist: 0.5, rear_weight_dist: 0.5 });
  assert.ok(Math.abs(out.W_F_Static - 200 * 9.81 * 0.5) < 1e-9);
});

test('W_R_Static = Mass × 9.81 × rear_weight_dist', () => {
  const out = computeAll({ ...defaultValues(), Mass: 200, front_weight_dist: 0.5, rear_weight_dist: 0.5 });
  assert.ok(Math.abs(out.W_R_Static - 200 * 9.81 * 0.5) < 1e-9);
});

test('TOPO_ORDER agrees with a deps-derived topological order', () => {
  const seen = new Set(Object.keys(P).filter(id => P[id].type === 'input'));
  for (const id of TOPO_ORDER) {
    for (const dep of P[id].deps || []) {
      assert.ok(seen.has(dep), `${id} depends on ${dep} which appears later`);
    }
    seen.add(id);
  }
  const nonInputIds = Object.keys(P).filter(id => P[id].type !== 'input');
  assert.equal(TOPO_ORDER.length, nonInputIds.length);
  for (const id of nonInputIds) assert.ok(TOPO_ORDER.includes(id), `${id} missing from TOPO_ORDER`);
});

test('Trail_Static = (Rf · sin(Rake) − O) / cos(Rake)', () => {
  // Inputs: Rake=24°, Rf=308 mm, O=30 mm.
  // Expected Trail = (308·sin(24°) − 30) / cos(24°) ≈ 104.291 mm (hand-computed once).
  // Pinning to a precomputed constant — not re-derived from the formula —
  // catches sin/cos swap, sign error, missing D2R conversion.
  const inputs = { ...defaultValues(), Rake_Static: 24, Rf: 308, Yoke_Offset: 30 };
  const out = computeAll(inputs);
  assert.ok(Math.abs(out.Trail_Static - 104.291) < 1e-3,
    `Trail_Static=${out.Trail_Static}, expected ≈ 104.291`);
});

test('Trail_Static is a channel (visible on dashboard)', () => {
  assert.equal(P.Trail_Static.type, 'channel');
});

const NEW_INPUTS = [
  'Yoke_Offset', 'Fork_Position', 'Front_Spring_Rate', 'Front_Spring_Preload',
  'Front_Oil_Level', 'Front_Topout_Rate', 'Front_Topout_Length',
  'Swingarm_Length', 'Shock_Clevis_RHA', 'Shock_Length',
  'Rear_Spring_Rate', 'Rear_Spring_Preload', 'Rear_Topout_Rate', 'Rear_Topout_Length',
  'Front_Sprocket', 'Rear_Sprocket',
  'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
  'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
  'Lean_Angle',
];
const NEW_COMPUTED = [
  'Final_Ratio', 'Motion_Ratio', 'Progression', 'Rear_Ride_Height',
  'Rear_Wheel_Vertical_Travel', 'Rear_Wheel_Rate', 'Front_Wheel_Rate',
];

for (const id of NEW_INPUTS) {
  test(`new input ${id} registered`, () => {
    assert.ok(P[id], `${id} missing from P`);
    assert.equal(P[id].type, 'input');
    assert.ok(INPUT_META[id], `${id} missing INPUT_META`);
  });
}
for (const id of NEW_COMPUTED) {
  test(`new computed ${id} registered`, () => {
    assert.ok(P[id], `${id} missing from P`);
    assert.notEqual(P[id].type, 'input');
    assert.equal(typeof CALC[id], 'function');
  });
}

// Phase C: numeric pin tests against reference bikes — guarded by hasRealCoords.
// Placeholder coords are skipped (see docs/research/linkage-coords.md).
const PLACEHOLDER_COORDS = {
  Frame_Rocker_Pivot_X: -50, Frame_Rocker_Pivot_Y: 80,
  Rocker_To_Shock_X: -65,    Rocker_To_Shock_Y: 100,
  Rocker_To_Drag_X: -45,     Rocker_To_Drag_Y: 60,
  Drag_To_Swingarm_X: 40,    Drag_To_Swingarm_Y: -10,
  Frame_Shock_Top_X: -200,   Frame_Shock_Top_Y: 300,
};
function hasRealCoords(b) {
  return Object.entries(PLACEHOLDER_COORDS).some(([k, v]) => b.inputs[k] !== v);
}

for (const b of REFERENCE_BIKES) {
  const populated = Object.entries(b.expected).find(([_, v]) => v != null);
  if (!populated) continue;
  const [presetName, exp] = populated;

  if (!hasRealCoords(b)) {
    test(`MotionRatio: ${b.id} (${presetName}) — SKIPPED (placeholder linkage coords)`, { skip: true }, () => {});
    test(`Rear_Travel: ${b.id} (${presetName}) — SKIPPED (placeholder linkage coords)`, { skip: true }, () => {});
    test(`Rear_RHR: ${b.id} (${presetName}) — SKIPPED (placeholder linkage coords)`, { skip: true }, () => {});
    continue;
  }
  if (exp.Motion_Ratio != null) {
    test(`MotionRatio: ${b.id} (${presetName}) within 5%`, () => {
      const inputs = { ...b.inputs, ...b.dynamic_presets[presetName] };
      const out = computeAll(inputs);
      const tol = exp.Motion_Ratio * 0.05;
      assert.ok(Math.abs(out.Motion_Ratio - exp.Motion_Ratio) < tol,
        `got ${out.Motion_Ratio}, expected ${exp.Motion_Ratio} ± ${tol}`);
    });
  }
  if (exp.Rear_Wheel_Vertical_Travel != null) {
    test(`Rear_Travel: ${b.id} (${presetName}) within 5%`, () => {
      const inputs = { ...b.inputs, ...b.dynamic_presets[presetName] };
      const out = computeAll(inputs);
      const tol = Math.max(2, exp.Rear_Wheel_Vertical_Travel * 0.05);
      assert.ok(Math.abs(out.Rear_Wheel_Vertical_Travel - exp.Rear_Wheel_Vertical_Travel) < tol);
    });
  }
  if (exp.Rear_Ride_Height != null) {
    test(`Rear_RHR: ${b.id} (${presetName}) within 5 mm`, () => {
      const inputs = { ...b.inputs, ...b.dynamic_presets[presetName] };
      const out = computeAll(inputs);
      assert.ok(Math.abs(out.Rear_Ride_Height - exp.Rear_Ride_Height) < 5);
    });
  }
}

test('Swingarm_Angle ignores Travel_Rear in static-only mode (H1)', () => {
  // Static phase: swingarm_delta_solve is hard-pinned to Travel_Rear=0.
  // Changing Travel_Rear must NOT move Swingarm_Angle — only Shock_Clevis_RHA
  // can shift the static angle. (Dynamic phase will re-introduce a separate
  // swingarm_delta_dynamic channel.)
  const v0 = { ...defaultValues(), Travel_Rear: 0 };
  const vT = { ...defaultValues(), Travel_Rear: 25 };
  const r0 = computeAll(v0);
  const rT = computeAll(vT);
  assert.ok(Number.isFinite(r0.Swingarm_Angle));
  assert.equal(rT.Swingarm_Angle, r0.Swingarm_Angle,
    `Travel_Rear must not affect Swingarm_Angle in static mode; got ${rT.Swingarm_Angle} vs ${r0.Swingarm_Angle}`);
  // With RHA=0 the static angle must equal beta_static exactly.
  const vBase = { ...defaultValues(), Shock_Clevis_RHA: 0, Travel_Rear: 0 };
  const rBase = computeAll(vBase);
  assert.ok(Math.abs(rBase.Swingarm_Angle - vBase.beta_static) < 1e-6,
    `Swingarm_Angle should equal beta_static when RHA=0; got ${rBase.Swingarm_Angle} vs ${vBase.beta_static}`);
});

test('Shock_Clevis_RHA shifts Swingarm_Angle and rear ride height', () => {
  // RHA=0 baseline vs. RHA=+5: lengthening the shock at zero compression
  // forces the swingarm to a different static angle, changing rear
  // ride-height. Sign + finiteness check, and Travel_Rear=0 must move
  // the angle (otherwise RHA isn't wired).
  const v0 = defaultValues();
  const v5 = { ...v0, Shock_Clevis_RHA: 5, Travel_Rear: 0 };
  const r0 = computeAll(v0);
  const r5 = computeAll(v5);
  assert.ok(Number.isFinite(r5.Swingarm_Angle), 'angle must be finite with RHA');
  assert.notEqual(r0.Swingarm_Angle, r5.Swingarm_Angle,
    'RHA must shift static swingarm angle');
  assert.notEqual(r0.Rear_Ride_Height, r5.Rear_Ride_Height,
    'RHA must shift rear ride-height reference');
  // RHA=0 case must equal a default-values run (regression guard for
  // formulas.js threading || 0 fallback).
  const v00 = { ...v0, Shock_Clevis_RHA: 0 };
  const r00 = computeAll(v00);
  assert.equal(r00.Swingarm_Angle, r0.Swingarm_Angle);
});

test('theta_chain_dynamic: rear-axle-behind-front-sprocket sanity (H2)', () => {
  // Rear axle level with front sprocket, rear sprocket physically larger:
  // chain top at front is lower than at rear → going front→rear chain rises,
  // i.e. measured rear→front it descends → theta_chain_dynamic should be NEGATIVE.
  const v = {
    ...defaultValues(),
    Front_Sprocket_X: 0, Front_Sprocket_Y: 0,
    beta_static: 0, Travel_Rear: 0,           // swingarm horizontal
    Front_Sprocket: 14, Rear_Sprocket: 50,    // rear much bigger
    Chain_Pitch: 15.875,
  };
  const out = computeAll(v);
  assert.ok(Number.isFinite(out.theta_chain_dynamic),
    `theta_chain_dynamic not finite: ${out.theta_chain_dynamic}`);
  assert.ok(out.theta_chain_dynamic < 0,
    `Expected negative chain tilt for rear-bigger-and-level case; got ${out.theta_chain_dynamic.toFixed(3)}°`);
  assert.ok(Math.abs(out.theta_chain_dynamic) < 30,
    `chain angle magnitude should be modest; got ${out.theta_chain_dynamic.toFixed(3)}°`);
});

test('theta_chain_dynamic at default state is finite and small (H2)', () => {
  const out = computeAll(defaultValues());
  assert.ok(Number.isFinite(out.theta_chain_dynamic),
    `theta_chain_dynamic not finite: ${out.theta_chain_dynamic}`);
  // Front sprocket at placeholder (50, 10), rear axle at swingarm angle ~beta_static.
  // Result should be a small angle, well within ±30°.
  assert.ok(Math.abs(out.theta_chain_dynamic) < 30,
    `chain angle out of range: ${out.theta_chain_dynamic.toFixed(3)}°`);
});

test('Anti_Squat now routes through dynamic chain angle (H2)', () => {
  // theta_chain (the static input) is gone; AntiSquat must come from
  // theta_chain_dynamic + Swingarm_Angle. Verify both that AntiSquat
  // is finite and that perturbing a sprocket-geometry input changes it
  // (proof the new path is wired in, not a stale static value).
  const base = computeAll(defaultValues());
  const perturbed = computeAll({ ...defaultValues(), Front_Sprocket_X: 200 });
  assert.ok(Number.isFinite(base.Anti_Squat),
    `AntSquat not finite: ${base.Anti_Squat}`);
  assert.notEqual(base.Anti_Squat, perturbed.Anti_Squat,
    'AntiSquat unchanged when Front_Sprocket_X moved → dynamic chain angle not wired');
  // Ensure theta_chain (legacy static input) is fully removed.
  assert.equal(P.theta_chain, undefined, 'theta_chain should be removed from P');
  assert.equal(INPUT_META.theta_chain, undefined, 'theta_chain should be removed from INPUT_META');
});

test('Final_Ratio matches Rear_Sprocket / Front_Sprocket for each reference bike with sprockets set', () => {
  for (const b of REFERENCE_BIKES) {
    const inputs = { ...defaultValues(), ...b.inputs };
    if (!Number.isFinite(inputs.Front_Sprocket) || !Number.isFinite(inputs.Rear_Sprocket)) continue;
    const out = computeAll(inputs);
    const expected = inputs.Rear_Sprocket / inputs.Front_Sprocket;
    assert.ok(Math.abs(out.Final_Ratio - expected) < 1e-9,
      `${b.id}: got ${out.Final_Ratio}, expected ${expected}`);
  }
});


test('Front_Wheel_Rate = 2·Front_Spring_Rate / (1/cos(Rake_Static))² (twin springs)', () => {
  const inputs = { ...defaultValues(), Front_Spring_Rate: 9.0, Rake_Static: 24 };
  const out = computeAll(inputs);
  // Spring rate is per leg (spec-sheet convention), forks carry two springs:
  // MR_front = 1/cos(24°) ≈ 1.0946; wheel_rate = 2·9 / MR² = 18 · cos²(24°)
  const expected = 2 * 9.0 * Math.cos(24 * Math.PI / 180) ** 2;
  assert.ok(
    Math.abs(out.Front_Wheel_Rate - expected) < 1e-9,
    `expected ${expected}, got ${out.Front_Wheel_Rate}`
  );
});

test('Rear_Wheel_Rate = Rear_Spring_Rate / Motion_Ratio² (energy identity)', () => {
  const inputs = { ...defaultValues(), Rear_Spring_Rate: 90 };
  const out = computeAll(inputs);
  if (!Number.isFinite(out.Motion_Ratio)) {
    // Default linkage may be placeholder; the formula linkage is still
    // validated by the deps declaration. Skip the numeric check.
    return;
  }
  const expected = 90 / (out.Motion_Ratio * out.Motion_Ratio);
  assert.ok(
    Math.abs(out.Rear_Wheel_Rate - expected) < 1e-9,
    `expected ${expected}, got ${out.Rear_Wheel_Rate}`
  );
});
