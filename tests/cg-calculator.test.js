// ============================================================
// Centre-of-gravity calculator (two-condition scale method)
// ============================================================
//
// The solver is checked against SYNTHETIC readings generated from a known
// CG: place the mass, compute the scale readings physics would produce,
// then confirm the solver recovers the original numbers. That is the only
// way to test this without a real bike on real scales.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCG, defaultCgRows, blankCgRow, MAX_CG_ROWS, CG_ENDS, renderCgCalculator }
  from '../src/cg-calculator.js';

// Generate the exact readings a bike with this CG would produce.
//   L  wheelbase, W total, a CG ahead of the rear axle, hGround CG height,
//   r  axle height (rolling radius)
function synth({ L = 1400, W = 265, a = 728, hGround = 650, r = 305 } = {}) {
  const hAxle = hGround - r;
  const level = { end: 'level', height: 0, front: W * a / L, rear: W - W * a / L };
  const rearRaised = (H) => {
    const t = Math.tan(Math.asin(H / L));
    const f = W * a / L + W * hAxle * t / L;
    return { end: 'rear', height: H, front: f, rear: W - f };
  };
  const frontRaised = (H) => {
    const t = Math.tan(Math.asin(H / L));
    const rr = W * (L - a) / L + W * hAxle * t / L;
    return { end: 'front', height: H, front: W - rr, rear: rr };
  };
  return { level, rearRaised, frontRaised, L, W, a, hGround, r };
}

test('recovers a known CG exactly from level + rear-raised readings', () => {
  const s = synth();
  const out = solveCG([s.level, s.rearRaised(600)], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(Math.abs(out.L_CG - s.a) < 1e-6);
  assert.ok(Math.abs(out.H_CG - s.hGround) < 1e-6);
  assert.ok(Math.abs(out.Mass - s.W) < 1e-9);
  assert.deepEqual(out.warnings, []);
});

test('raising the front gives the same answer as raising the rear', () => {
  const s = synth();
  const rear  = solveCG([s.level, s.rearRaised(600)],  { wheelbase: s.L, axleHeight: s.r });
  const front = solveCG([s.level, s.frontRaised(600)], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(Math.abs(rear.H_CG - front.H_CG) < 1e-6);
});

test('the raised height cancels out — 500 and 700 mm agree', () => {
  const s = synth();
  const a = solveCG([s.level, s.rearRaised(500)], { wheelbase: s.L, axleHeight: s.r });
  const b = solveCG([s.level, s.rearRaised(700)], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(Math.abs(a.H_CG - b.H_CG) < 1e-6);
});

test('multiple readings average, and the spread is reported', () => {
  const s = synth();
  const out = solveCG(
    [s.level, s.level, s.rearRaised(600), s.frontRaised(550), s.rearRaised(500)],
    { wheelbase: s.L, axleHeight: s.r });
  assert.equal(out.nLevel, 2);
  assert.equal(out.nRaised, 3);
  assert.ok(Math.abs(out.H_CG - s.hGround) < 1e-6);
  assert.ok(out.spread < 1e-6, 'identical physics should produce no spread');
});

test('front share and L_CG are consistent with each other', () => {
  const s = synth({ a: 700, L: 1400 });
  const out = solveCG([s.level, s.rearRaised(600)], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(Math.abs(out.frontShare - 0.5) < 1e-9);
  assert.ok(Math.abs(out.L_CG - out.frontShare * s.L) < 1e-9);
});

test('half a kilo of scale error really is about 5 mm of CG height', () => {
  // The manual's rule of thumb, and the reason repeat readings matter.
  const s = synth();
  const clean = s.rearRaised(600);
  const noisy = { ...clean, front: clean.front + 0.5, rear: clean.rear - 0.5 };
  const a = solveCG([s.level, clean], { wheelbase: s.L, axleHeight: s.r });
  const b = solveCG([s.level, noisy], { wheelbase: s.L, axleHeight: s.r });
  const d = b.H_CG - a.H_CG;
  assert.ok(d > 3 && d < 8, `0.5 kg moved the CG ${d.toFixed(1)} mm — expected roughly 5`);
});

test('nothing is returned that cannot be honestly derived', () => {
  const s = synth();
  // No wheelbase → no horizontal position, so nothing at all.
  let out = solveCG([s.level, s.rearRaised(600)], {});
  assert.equal(out.L_CG, null);
  assert.equal(out.H_CG, null);
  assert.ok(out.warnings.includes('no_wheelbase'));

  // No level reading → the horizontal reference is missing.
  out = solveCG([s.rearRaised(600)], { wheelbase: s.L, axleHeight: s.r });
  assert.equal(out.L_CG, null);
  assert.ok(out.warnings.includes('need_level'));

  // Level only → horizontal is real, height is not invented.
  out = solveCG([s.level], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(Math.abs(out.L_CG - s.a) < 1e-6);
  assert.equal(out.H_CG, null);
  assert.ok(out.warnings.includes('need_raised'));

  // No axle height → height above the axle line is still real; height
  // above ground is not known and stays null.
  out = solveCG([s.level, s.rearRaised(600)], { wheelbase: s.L });
  assert.ok(out.heightAboveAxle > 0);
  assert.equal(out.H_CG, null);
  assert.ok(out.warnings.includes('need_axle_height'));
});

test('partly-filled rows are ignored rather than half-counted', () => {
  const s = synth();
  const halfRow = { end: 'rear', height: 600, front: 150, rear: null };
  const out = solveCG([s.level, halfRow, s.rearRaised(600)], { wheelbase: s.L, axleHeight: s.r });
  assert.equal(out.nRaised, 1);
  assert.ok(Math.abs(out.H_CG - s.hGround) < 1e-6);
});

test('warns when the raised angle is too shallow to trust', () => {
  const s = synth();
  // 300 mm on a 1400 mm wheelbase is ~12°, under the 20° guidance.
  const out = solveCG([s.level, s.rearRaised(300)], { wheelbase: s.L, axleHeight: s.r });
  assert.ok(out.warnings.includes('angle_low'));
  // …but it still produces the right answer; the warning is advice.
  assert.ok(Math.abs(out.H_CG - s.hGround) < 1e-6);
});

test('warns when weight goes missing between rows (a support taking load)', () => {
  const s = synth();
  const light = s.rearRaised(600);
  const out = solveCG(
    [s.level, { ...light, front: light.front - 6 }],
    { wheelbase: s.L, axleHeight: s.r });
  assert.ok(out.warnings.includes('weight_missing'));
});

test('warns when the per-row heights scatter badly', () => {
  const s = synth();
  const a = s.rearRaised(600);
  const b = s.rearRaised(600);
  const out = solveCG(
    [s.level, a, { ...b, front: b.front + 4, rear: b.rear - 4 }],
    { wheelbase: s.L, axleHeight: s.r });
  assert.ok(out.warnings.includes('scatter_high'));
  assert.ok(out.spread > 25);
});

test('a raised row that gains no load on the far scale is rejected with a reason', () => {
  const s = synth();
  // "Rear raised" but the front scale reads the level value — impossible.
  const out = solveCG([s.level, { end: 'rear', height: 600, front: s.level.front, rear: s.level.rear }],
    { wheelbase: s.L, axleHeight: s.r });
  assert.equal(out.H_CG, null);
  assert.equal(out.perRow[0].reason, 'no_transfer');
  assert.ok(out.warnings.includes('no_usable_raised'));
});

test('a raised height beyond the wheelbase is rejected, not asin(NaN)', () => {
  const s = synth();
  const out = solveCG([s.level, { end: 'rear', height: 2000, front: 200, rear: 65 }],
    { wheelbase: s.L, axleHeight: s.r });
  assert.equal(out.perRow[0].reason, 'height_exceeds_wheelbase');
  assert.equal(out.H_CG, null);
});

test('defaults give a usable starting table', () => {
  const rows = defaultCgRows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].end, 'level');
  assert.ok(rows.some(r => r.end !== 'level'));
  // A blank row is genuinely blank — no zeros pretending to be readings.
  const b = blankCgRow('rear');
  assert.equal(b.front, null);
  assert.equal(b.rear, null);
  assert.ok(MAX_CG_ROWS >= 4);
  assert.deepEqual(CG_ENDS, ['level', 'rear', 'front']);
});

test('renders in both languages with wired handlers and no fake numbers', () => {
  for (const lang of ['zh', 'en']) {
    const html = renderCgCalculator({ rows: defaultCgRows(), values: { WB: 1400, Rf: 305 }, lang });
    assert.match(html, /setCgRow\(0, 'end'/);
    assert.match(html, /onclick="addCgRow\(\)"/);
    assert.match(html, /onclick="applyCgResult\(\)"/);
    // Nothing measured yet → Apply must be disabled and no result shown.
    assert.match(html, /applyCgResult\(\)" disabled/);
    assert.match(html, /—/);
  }
});

test('render surfaces the per-row angle once a row is solvable', () => {
  const s = synth();
  const html = renderCgCalculator({
    rows: [s.level, s.rearRaised(600)],
    values: { WB: s.L, Rf: s.r },
    lang: 'en',
  });
  assert.match(html, /25\.4° → 345 mm/);       // asin(600/1400) and h above axle
  assert.doesNotMatch(html, /applyCgResult\(\)" disabled/);
});
