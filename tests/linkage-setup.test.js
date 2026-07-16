// tests/linkage-setup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLinkageSetup } from '../src/linkage-setup.js';
import { defaultValues } from '../src/formulas.js';

test('linkage-setup: page renders without crashing', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  assert.ok(html.length > 500, 'page suspiciously short');
});

test('linkage-setup: page contains all 10 coordinate inputs', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  for (const id of [
    'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
    'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
    'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
    'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
    'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
  ]) {
    assert.match(html, new RegExp(id), `missing input ${id}`);
  }
});

test('linkage-setup: page contains live readouts for derived metrics', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  for (const id of ['Motion_Ratio', 'Progression', 'Rear_Ride_Height']) {
    assert.match(html, new RegExp(`data-live="${id}"`), `missing live readout for ${id}`);
  }
});

test('linkage-setup: page contains an SVG', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  assert.match(html, /<svg/);
});

test('linkage-setup: page renders in english when state.lang === "en"', () => {
  const html = renderLinkageSetup({ values: defaultValues(), lang: 'en' });
  // "Rocker Pivot" appears in both the linked-mode label
  // ("Frame Rocker Pivot") and the pro-link label
  // ("Rocker Pivot (on swingarm)"), so this assertion is mode-agnostic.
  assert.match(html, /Rocker Pivot/);
});

// ---------------------------------------------------------------------------
// Default placeholders must behave like production linkages. These pins
// exist because the original placeholders produced MR ≈ 3.9 (real sport
// bikes: ~1.8–2.6 per published wheel-travel/shock-stroke ratios) and a
// fixture once "validated" wheel rates against that fake output.
// ---------------------------------------------------------------------------
test('both placeholder linkages produce realistic, monotonic kinematics', async () => {
  const { LINKAGE_PLACEHOLDER_LINKED, LINKAGE_PLACEHOLDER_PROLINK } =
    await import('../src/linkage-setup.js');
  const { motionRatio, shockLength } = await import('../src/linkage.js');
  const cases = [
    { name: 'linked',   cfg: { ...LINKAGE_PLACEHOLDER_LINKED,  Linkage_Mode: 'linked' } },
    { name: 'pro-link', cfg: { ...LINKAGE_PLACEHOLDER_PROLINK, Linkage_Mode: 'pro-link' } },
  ];
  for (const { name, cfg } of cases) {
    const s0 = shockLength(cfg, 0);
    assert.ok(Math.abs(s0 - 310) < 15,
      `${name}: static shock ${s0?.toFixed(1)} should ≈ Shock_Length default (310)`);
    let prev = null;
    for (let d = -25; d <= 25; d += 2.5) {
      const s = shockLength(cfg, d);
      assert.ok(Number.isFinite(s), `${name}: locks at δ=${d}°`);
      if (prev !== null) assert.ok(s > prev, `${name}: shockLength not monotonic at δ=${d}°`);
      prev = s;
    }
    for (const d of [-25, 0, 25]) {
      const mr = motionRatio(cfg, d, 580, 14);
      assert.ok(mr > 1.8 && mr < 2.8,
        `${name}: MR(${d}°)=${mr?.toFixed(2)} outside real-bike band 1.8–2.8`);
    }
  }
});

test('INPUT_META linkage defaults equal the pro-link placeholder', async () => {
  const { LINKAGE_PLACEHOLDER_PROLINK, LINKAGE_COORD_FIELDS } =
    await import('../src/linkage-setup.js');
  const { INPUT_META } = await import('../src/formulas.js');
  for (const k of LINKAGE_COORD_FIELDS) {
    assert.equal(INPUT_META[k].def, LINKAGE_PLACEHOLDER_PROLINK[k],
      `${k}: INPUT_META default drifted from the pro-link placeholder`);
  }
});
