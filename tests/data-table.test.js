import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, ROW_GROUPS, defaultBikes, PRESET_VALUES } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';

function render(extra = {}) {
  const bikes = defaultBikes();
  return renderDataTable({ values: defaultValues(), bikes, lang: 'en', ...extra });
}

test('table contains every CSV group header', () => {
  const html = render();
  for (const expected of ['FRONT SETTINGS', 'REAR SETTINGS', 'TIRES', 'SPROCKETS', 'DYNAMIC READINGS', 'RESULTS']) {
    assert.match(html, new RegExp(expected));
  }
});

test('table contains 3 editable bike-name inputs', () => {
  const html = render();
  for (const name of ['Yamaha R7', 'Suzuki GSX-8R', 'Aprilia RS 660']) {
    assert.match(html, new RegExp(`<input[^>]*class="[^"]*dt-bike-name[^"]*"[^>]*value="${name}[^"]*"`));
  }
});

test('table has no Current column', () => {
  const html = render();
  assert.doesNotMatch(html, /dt-current/);
  assert.doesNotMatch(html, />Current</);
  // group header colspan is now 4 (param + 3 bikes), not 5
  assert.match(html, /colspan="4"/);
  assert.doesNotMatch(html, /colspan="5"/);
});

test('numeric input rows render <input type="number"> cells per bike', () => {
  const html = render();
  // Yoke_Offset row should produce 3 number inputs
  const matches = html.match(/oninput="setBikeInput\(\d+, 'Yoke_Offset'/g) || [];
  assert.equal(matches.length, 3);
});

test('component rows render <select> wired to setBikeComponent', () => {
  const html = render();
  for (const c of ['clamp', 'fork', 'shock', 'swingarm', 'linkage', 'front_tire', 'rear_tire']) {
    assert.match(html, new RegExp(`onchange="setBikeComponent\\(\\d+, '${c}'`),
      `missing component select for ${c}`);
  }
  // datalists are gone — no more text-input profile cells
  assert.doesNotMatch(html, /id="dt-options-/);
});

test('DYNAMIC READINGS section contains a preset selector per bike column', () => {
  const html = render();
  const matches = html.match(/onchange="applyBikePreset\(\d+/g) || [];
  assert.equal(matches.length, 3);
});

test('RESULTS rows are read-only spans, not inputs', () => {
  const html = render();
  // find the Rake row (anchored on its <th class="dt-spec">)
  const rowMatch = html.match(/<tr><th class="dt-spec">Rake \(degrees\)[\s\S]*?<\/tr>/);
  assert.ok(rowMatch);
  assert.doesNotMatch(rowMatch[0], /<input/);
  assert.match(rowMatch[0], /dt-readonly/);
});

test('NaN computed cells render as em-dash', () => {
  const html = render();
  assert.match(html, /—/);
});

test('every ROW_GROUPS row has at least one of input/computed/component/literal/preset/derivedFrom', () => {
  for (const g of ROW_GROUPS) for (const r of g.rows) {
    const has = r.input != null || r.computed != null || r.component != null
             || r.literal != null || r.preset != null || r.derivedFrom != null;
    assert.ok(has, `row "${r.spec}" has no value source`);
  }
});

test('H3: braking preset drives a_x and V', () => {
  const bikes = defaultBikes();
  const braking = bikes.find(b => b.preset === 'braking');
  assert.ok(braking, 'expected one bike to use the braking preset');
  assert.equal(braking.values.a_x, -0.8);
  assert.equal(braking.values.V, 25);
});

test('H3: dynamic-load + frame-intrinsic input rows exist in ROW_GROUPS', () => {
  const allRows = ROW_GROUPS.flatMap(g => g.rows);
  for (const k of ['a_x', 'V', 'Cd', 'A', 'front_weight_dist', 'rear_weight_dist', 'C_f_aero', 'C_r_aero']) {
    assert.ok(allRows.some(r => r.input === k), `missing input row for ${k}`);
  }
});

test('H3: MotoSPEC_FrontForce / RearForce rows no longer carry status: partial', () => {
  const allRows = ROW_GROUPS.flatMap(g => g.rows);
  const frontForce = allRows.find(r => r.computed === 'MotoSPEC_FrontForce');
  const rearForce = allRows.find(r => r.computed === 'MotoSPEC_RearForce');
  assert.ok(frontForce);
  assert.ok(rearForce);
  assert.notEqual(frontForce.status, 'partial');
  assert.notEqual(rearForce.status, 'partial');
});

test('defaultBikes seeds three bikes with components + preset-aligned dynamic values', () => {
  const bikes = defaultBikes();
  assert.equal(bikes.length, 3);
  for (const b of bikes) {
    assert.ok(b.id);
    assert.ok(b.name);
    assert.ok(b.values);
    assert.ok(b.components, 'bike must carry component refs');
    for (const k of ['fork', 'shock', 'swingarm', 'linkage', 'clamp', 'front_tire', 'rear_tire']) {
      assert.ok(b.components[k], `bike ${b.name} missing component ref ${k}`);
    }
    assert.ok(['sag', 'braking', 'mid_corner', 'custom'].includes(b.preset));
    const expected = PRESET_VALUES[b.preset];
    if (expected) {
      assert.equal(b.values.Travel_Front, expected.Travel_Front);
      assert.equal(b.values.Travel_Rear, expected.Travel_Rear);
      assert.equal(b.values.Lean_Angle, expected.Lean_Angle);
    }
  }
});
