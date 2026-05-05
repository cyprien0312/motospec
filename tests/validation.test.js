// tests/validation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAll, defaultValues } from '../src/formulas.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/reference-bikes.json', import.meta.url), 'utf8')
);

for (const bike of fixture.bikes) {
  test(`spec sheet: ${bike.name}`, () => {
    const inputs = { ...defaultValues(), ...bike.inputs };
    const out = computeAll(inputs);
    for (const [key, want] of Object.entries(bike.expected.spec_sheet)) {
      const got = out[key];
      const tol = bike.tolerance_mm ?? 1;
      assert.ok(Math.abs(got - want) <= tol,
        `${key}: got ${got.toFixed(2)}, expected ${want} (±${tol})`);
    }
  });

  if (bike.expected.motospec) {
    test(`motospec parity: ${bike.name}`, () => {
      const inputs = { ...defaultValues(), ...bike.inputs };
      const out = computeAll(inputs);
      for (const [key, want] of Object.entries(bike.expected.motospec)) {
        const got = out[key];
        const tol = bike.tolerance_mm ?? 1;
        assert.ok(Math.abs(got - want) <= tol,
          `${key}: got ${got.toFixed(2)}, motospec ${want} (±${tol})`);
      }
    });
  }
}
