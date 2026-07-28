// ============================================================
// Direct / Linkless rear suspension (third linkage mode)
// ============================================================
//
// No rocker: the shock bolts straight from the swingarm to the frame
// (Yamaha R3, KTM 890/990 Duke). There is no 4-bar closure to solve, so
// the mode must never be able to produce the "unconverged" NaN the other
// two modes guard against — but it must still reduce to the same
// degeneracies (zero sag = zero travel) and stay physically plausible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shockLength, shockLowerEnd, motionRatio, swingarmDeltaForShockTravel } from '../src/linkage.js';
import {
  LINKAGE_PLACEHOLDER_LINKLESS, LINKAGE_MODES, LINKLESS_USED_POINT_KEYS,
  placeholderForMode, matchesPlaceholder, buildLinkagePresetEntry,
  renderLinkageSetup, LINKAGE_POINTS,
} from '../src/linkage-setup.js';
import { defaultValues, computeAll } from '../src/formulas.js';

const cfg = (extra = {}) => ({
  ...defaultValues(),
  ...LINKAGE_PLACEHOLDER_LINKLESS,
  Linkage_Mode: 'linkless',
  Shock_Length: 313, Shock_Length_ref: 313,
  ...extra,
});

test('linkless is a first-class mode with its own placeholder', () => {
  assert.ok(LINKAGE_MODES.includes('linkless'));
  assert.equal(placeholderForMode('linkless'), LINKAGE_PLACEHOLDER_LINKLESS);
  assert.ok(matchesPlaceholder(cfg(), 'linkless'));
  // Unknown modes still fall back to linked, as before.
  assert.equal(placeholderForMode('nonsense'), placeholderForMode('linked'));
});

test('shock lower end simply rotates with the swingarm — no closure to fail', () => {
  const v = cfg();
  const at0 = shockLowerEnd(v, 0);
  assert.ok(Math.abs(at0.x - v.Drag_To_Swingarm_X) < 1e-12);
  assert.ok(Math.abs(at0.y - v.Drag_To_Swingarm_Y) < 1e-12);
  // Rotation preserves the radius from the pivot exactly.
  const r0 = Math.hypot(at0.x, at0.y);
  for (const d of [-30, -10, 10, 30]) {
    const p = shockLowerEnd(v, d);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - r0) < 1e-9, `radius changed at ${d}°`);
  }
});

test('shock length is finite and monotonic over the whole working range', () => {
  const v = cfg();
  let prev = -Infinity;
  for (let d = -30; d <= 15; d += 1) {
    const s = shockLength(v, d);
    assert.ok(Number.isFinite(s), `NaN shock length at ${d}°`);
    assert.ok(s > prev, `not monotonic at ${d}°`);
    prev = s;
  }
});

test('bump compresses the shock (sign convention matches the rocker modes)', () => {
  const v = cfg();
  // Negative delta = swingarm toward horizontal = wheel up = compression.
  assert.ok(shockLength(v, -10) < shockLength(v, 0));
  assert.ok(shockLength(v, 10) > shockLength(v, 0));
});

test('the calibrated placeholder is physically plausible', () => {
  const v = cfg();
  const L = shockLength(v, 0);
  assert.ok(L > 280 && L < 330, `shock eye-to-eye ${L.toFixed(1)} mm is not a real shock`);
  const mr = computeAll(v).Motion_Ratio;
  assert.ok(mr > 1.3 && mr < 2.2, `motion ratio ${mr.toFixed(2)} is not a direct-mount value`);
});

test('linkless progression is near-zero — the honest answer, not a gap', () => {
  // With no rocker the only progression is the swingarm's own arc, so a
  // few tenths of a percent. If this ever reads like a linked bike (5-25%)
  // something is solving the wrong mechanism.
  const o = computeAll(cfg());
  assert.ok(Number.isFinite(o.Progression));
  assert.ok(o.Progression < 2, `progression ${o.Progression.toFixed(2)}% is too high for a linkless rear`);
  assert.ok(o.Progression_Wheel100 < 2);
});

test('motion-ratio reciprocal holds in linkless mode too', () => {
  const o = computeAll(cfg());
  assert.ok(Math.abs(o.Motion_Ratio * o.Motion_Ratio_Shock_Wheel - 1) < 1e-12);
});

test('zero sag still degenerates exactly to static', () => {
  const o = computeAll(cfg());
  assert.equal(o.Shock_Travel_Live, 0);
  assert.equal(o.Rear_Stroke_Pct, 0);
  assert.equal(o.swingarm_delta_solve, 0);
  assert.ok(Math.abs(o.MotoSPEC_Rake - o.Rake_Static) < 1e-12);
});

test('rear sag compresses the shock by roughly wheel travel ÷ motion ratio', () => {
  const o = computeAll(cfg({ Sag_Rear: 35 }));
  assert.ok(o.Shock_Travel_Live > 0);
  const approx = 35 / o.Motion_Ratio;
  assert.ok(Math.abs(o.Shock_Travel_Live - approx) < 1.0,
    `4-bar-free solve ${o.Shock_Travel_Live.toFixed(2)} should track the linear estimate ${approx.toFixed(2)}`);
});

test('inverse solve round-trips: ask for N mm of travel, get N mm back', () => {
  const v = cfg();
  for (const travel of [5, 20, 45]) {
    const d = swingarmDeltaForShockTravel(v, travel, 0);
    assert.ok(Number.isFinite(d), `no solution for ${travel} mm`);
    const got = shockLength(v, 0) - shockLength(v, d);
    assert.ok(Math.abs(got - travel) < 1e-3, `${travel} mm -> ${got.toFixed(4)} mm`);
  }
});

test('an unreachable shock travel still returns NaN, never an endpoint', () => {
  // The lower mount can only swing so far; asking for more compression
  // than the geometry allows must not fake a finite answer.
  assert.ok(Number.isNaN(swingarmDeltaForShockTravel(cfg(), 5000, 0)));
});

test('a linkless profile round-trips through the linkage catalog', () => {
  const entry = buildLinkagePresetEntry('R3-ish', cfg());
  assert.equal(entry.specs.Linkage_Mode, 'linkless');
  // The unused rocker coords are still carried, so switching back to a
  // rocker mode does not lose the user's other measurements.
  assert.equal(entry.specs.Rocker_To_Shock_X, LINKAGE_PLACEHOLDER_LINKLESS.Rocker_To_Shock_X);
});

test('the page shows only the two coordinates linkless actually reads', () => {
  const html = renderLinkageSetup({ values: cfg(), lang: 'en' });
  const used = LINKAGE_POINTS.filter(p => LINKLESS_USED_POINT_KEYS.includes(p.key));
  for (const p of used) {
    assert.match(html, new RegExp(`setInputValue\\('${p.xKey}'`), `${p.key} should be editable`);
  }
  for (const p of LINKAGE_POINTS.filter(p => !LINKLESS_USED_POINT_KEYS.includes(p.key))) {
    assert.doesNotMatch(html, new RegExp(`setInputValue\\('${p.xKey}'`),
      `${p.key} takes no part in linkless and must not be shown`);
  }
  // Relabelled for the part the user actually measures.
  assert.match(html, /Shock ↔ Swingarm/);
  assert.match(html, /Shock ↔ Frame/);
  // The lengths-only input style describes a rocker triangle — hidden here.
  assert.doesNotMatch(html, /setLinkageInputStyle\('length'\)/);
});

test('the mode button and diagram caption exist for all three modes', () => {
  for (const m of LINKAGE_MODES) {
    const html = renderLinkageSetup({ values: { ...cfg(), Linkage_Mode: m }, lang: 'en' });
    assert.match(html, new RegExp(`setLinkageMode\\('${m}'\\)`));
  }
  assert.match(renderLinkageSetup({ values: cfg(), lang: 'en' }), /Direct \/ Linkless \(no rocker\)/);
});
