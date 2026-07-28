// ============================================================
// Parity against real MotoSPEC v5 output (screenshot oracle)
// ============================================================
//
// Four bikes × three setup columns of genuine MotoSPEC output, taken from
// the vendor's own help-manual screenshots — documentation that ships
// with the freely downloadable installer, not the paid per-model chassis
// files. See the `_provenance` and `_method` blocks in the fixture: in
// particular that these numbers were read off images by eye, so ~0.05 of
// rounding is inherent.
//
// This is a different instrument from tests/validation.test.js: that one
// checks published spec-sheet numbers for bikes we modelled ourselves;
// this one checks OUR CHAIN against ANOTHER SOLVER at three suspension
// positions of the same bike, which is what actually exercises the
// attitude/delta chain.
//
// Three tiers, because the honest answer is not uniform:
//   static  — topped out; must reproduce essentially exactly
//   working — up to 40 mm of fork travel; the range this tool is for
//   deep    — beyond that, our flat-plate pitch model under-predicts
//             pitch. Those rows PIN THE KNOWN ERROR rather than pretend
//             to pass, so a regression still fails the build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAll, defaultValues } from '../src/formulas.js';

const ORACLE = JSON.parse(
  readFileSync(new URL('./fixtures/motospec-oracle.json', import.meta.url), 'utf8')
);

const ANGLE_CHANNELS = new Set(['MotoSPEC_Rake', 'Swingarm_Angle']);

// Build our input dict for one column of one bike.
function inputsFor(bike, col) {
  return {
    ...defaultValues(),
    ...bike.static,
    // The bike is at its measurement baseline: every delta is zero.
    Swingarm_Length_ref: bike.static.Swingarm_Length,
    Yoke_Offset_ref: bike.static.Yoke_Offset,
    // MotoSPEC's front pot IS fork-axis compression = our Sag_Front.
    // Our Sag_Rear is vertical wheel travel, so it takes MotoSPEC's
    // rear_wheel_travel OUTPUT rather than its rear pot reading.
    Sag_Front: col.front_pot,
    Sag_Rear: col.rear_wheel_travel,
  };
}

test('the fixture carries its provenance and its warnings', () => {
  assert.match(ORACLE._provenance.origin, /help-manual screenshots/);
  assert.match(ORACLE._provenance.attribution, /Moto Race Services/);
  assert.match(ORACLE._provenance.accuracy_warning, /BY EYE|by a human/);
  assert.ok(ORACLE.bikes.length >= 4);
  assert.ok(ORACLE.bikes.every(b => b.columns.length >= 2));
});

test('every bike has a topped-out column that defines its static state', () => {
  for (const b of ORACLE.bikes) {
    const first = b.columns[0];
    assert.equal(first.tier, 'static', `${b.id}: column 1 must be the topped-out reference`);
    assert.equal(first.front_pot, 0);
    assert.equal(first.rear_wheel_travel, 0);
  }
});

test('the derived Rf agrees with the vendor tire library it was never fitted to', () => {
  // Rf comes from the ground-trail identity; the tire library comes from a
  // different screenshot entirely. They should land within a couple of mm,
  // and the derived (loaded) radius should not EXCEED the free centre
  // radius by much — a loaded tire is shorter, not taller.
  for (const b of ORACLE.bikes) {
    const x = b.Rf_note.nearest_library_entry;
    assert.ok(x, `${b.id}: no cross-check recorded`);
    assert.ok(Math.abs(x.delta) < 1.5,
      `${b.id}: derived Rf ${b.static.Rf} is ${x.delta} off ${x.tire} (${x.centre_radius}) — check the transcription`);
    // All four land BELOW the free centre radius, which is the signature
    // you would expect (MotoSPEC PRO compresses the tire under load) and
    // is strong evidence the derivation is sound rather than coincidental.
    assert.ok(x.delta < 0,
      `${b.id}: derived loaded radius ${b.static.Rf} exceeds the free centre radius ${x.centre_radius}`);
  }
});

for (const bike of ORACLE.bikes) {
  for (const col of bike.columns) {
    const label = `${bike.name} col${col.column}${col.label ? ' (' + col.label + ')' : ''} [${col.tier}]`;

    test(`oracle: ${label}`, () => {
      const out = computeAll(inputsFor(bike, col));
      const tier = ORACLE._tiers[col.tier];
      assert.ok(tier, `unknown tier ${col.tier}`);

      for (const [channel, want] of Object.entries(col.expect)) {
        if (want == null) continue;
        const got = out[channel];
        assert.ok(Number.isFinite(got), `${channel} came back non-finite`);
        const err = Math.abs(got - want);

        if (col.tier === 'deep') {
          // Known divergence: assert it stays inside the recorded envelope.
          const cap = tier.envelope[channel];
          assert.ok(cap != null, `${channel} has no recorded deep-travel envelope`);
          assert.ok(err <= cap,
            `${channel}: error ${err.toFixed(3)} exceeds the recorded deep-travel envelope ${cap} ` +
            `(got ${got.toFixed(3)}, MotoSPEC ${want}). Either the model regressed, or it IMPROVED ` +
            `and the envelope should be tightened.`);
        } else {
          const tol = ANGLE_CHANNELS.has(channel) ? tier.angle_deg : tier.length_mm;
          assert.ok(err <= tol,
            `${channel}: ${got.toFixed(3)} vs MotoSPEC ${want} — error ${err.toFixed(3)} > ${tol}`);
        }
      }
    });
  }
}

test('static columns reproduce MotoSPEC to better than a tenth', () => {
  // Stated separately from the per-column tests so the headline claim is
  // visible in the test names rather than buried in tolerances.
  let worstAngle = 0, worstLength = 0;
  for (const b of ORACLE.bikes) {
    const col = b.columns[0];
    const out = computeAll(inputsFor(b, col));
    for (const [ch, want] of Object.entries(col.expect)) {
      if (want == null) continue;
      const err = Math.abs(out[ch] - want);
      if (ANGLE_CHANNELS.has(ch)) worstAngle = Math.max(worstAngle, err);
      else worstLength = Math.max(worstLength, err);
    }
  }
  assert.ok(worstAngle < 0.02, `worst static angle error ${worstAngle}`);
  assert.ok(worstLength < 0.15, `worst static length error ${worstLength}`);
});

test('the rear ride height is GROUND-referenced (the bug this oracle caught)', () => {
  // Vertical Pivot-Axle = drop from a horizontal line through the pivot,
  // so it must use the swingarm angle to GROUND, chassis pitch included.
  // Computing it from the un-pitched angle was worth 44 mm at 120 mm of
  // fork travel. This asserts the identity directly on every column.
  const D2R = Math.PI / 180;
  for (const b of ORACLE.bikes) {
    for (const col of b.columns) {
      const out = computeAll(inputsFor(b, col));
      const identity = -b.static.Swingarm_Length * Math.sin(out.Swingarm_Angle * D2R);
      assert.ok(Math.abs(out.Rear_Ride_Height - identity) < 1e-9,
        `${b.id} col${col.column}: rear ride height is not -L·sin(angle to ground)`);
    }
  }
});
