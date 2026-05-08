import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_BIKES } from '../src/reference-bikes.js';

test('exactly three reference bikes', () => {
  assert.equal(REFERENCE_BIKES.length, 3);
});

test('each bike has id, name, inputs, dynamic_presets, expected', () => {
  for (const b of REFERENCE_BIKES) {
    for (const k of ['id', 'name', 'inputs', 'dynamic_presets', 'expected']) {
      assert.ok(k in b, `${b.name || '?'} missing ${k}`);
    }
    for (const preset of ['sag', 'braking', 'mid_corner']) {
      assert.ok(b.dynamic_presets[preset], `${b.id} missing preset ${preset}`);
    }
  }
});

// Bikes start as neutral placeholders (Bike A/B/C) with empty `expected`
// blocks. Numeric-pin tests are gated on real spec sheets being sourced
// into the chassis + linkage catalogs (see docs/research/).
test('each bike carries an `expected` dict (may be empty until spec sheets are sourced)', () => {
  for (const b of REFERENCE_BIKES) {
    assert.ok(b.expected != null && typeof b.expected === 'object', `${b.id} missing expected dict`);
  }
});
