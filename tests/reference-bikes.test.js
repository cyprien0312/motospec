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

test('each bike has at least one populated expected preset', () => {
  for (const b of REFERENCE_BIKES) {
    const populated = Object.values(b.expected || {}).filter(v => v != null).length;
    assert.ok(populated >= 1, `${b.id} has no populated expected preset`);
  }
});
