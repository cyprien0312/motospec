import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P, INPUT_META, CALC, TOPO_ORDER, defaultValues, computeAll } from '../src/formulas.js';

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

test('computeAll on defaults returns finite values for all params', () => {
  const out = computeAll(defaultValues());
  for (const id in P) {
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
  const inputs = { ...defaultValues(), Rake_Static: 24, Rf: 308, O: 30 };
  const out = computeAll(inputs);
  assert.ok(Math.abs(out.Trail_Static - 104.291) < 1e-3,
    `Trail_Static=${out.Trail_Static}, expected ≈ 104.291`);
});

test('Trail_Static is a channel (visible on dashboard)', () => {
  assert.equal(P.Trail_Static.type, 'channel');
});

