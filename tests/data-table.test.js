import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, ROW_GROUPS, defaultBikes, blankBike, MAX_BIKES } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';

function render(extra = {}) {
  const bikes = defaultBikes();
  return renderDataTable({ values: defaultValues(), bikes, lang: 'en', ...extra });
}

test('table contains every CSV group header', () => {
  const html = render();
  for (const expected of ['FRONT SETTINGS', 'REAR SETTINGS', 'SPROCKETS', 'RESULTS']) {
    assert.match(html, new RegExp(expected));
  }
});

test('table contains 3 editable bike-name inputs', () => {
  const html = render();
  const matches = html.match(/<input[^>]*class="[^"]*dt-bike-name[^"]*"/g) || [];
  assert.equal(matches.length, 3, 'expected exactly 3 editable bike-name inputs');
});

test('table has no Current column', () => {
  const html = render();
  assert.doesNotMatch(html, /dt-current/);
  assert.doesNotMatch(html, />Current</);
  // Group header colspan = 1 (Parameter) + bikes.length. Default 3 bikes → 4.
  assert.match(html, /colspan="4"/);
});

test('column add/remove: header has + Add button (when < MAX_BIKES) and × per column', () => {
  const html = render();
  assert.match(html, /class="dt-col-add"[^>]*onclick="addBike\(\)"/);
  const removeMatches = html.match(/onclick="removeBike\(\d+\)"/g) || [];
  assert.equal(removeMatches.length, 3, 'expected one × per bike column');
});

test('column add/remove: empty bikes array renders empty-state hint', () => {
  const html = renderDataTable({ values: defaultValues(), bikes: [], lang: 'en' });
  assert.match(html, /No bikes yet/);
  assert.match(html, /onclick="addBike\(\)"/);
  // No rows should render
  assert.doesNotMatch(html, /<tr class="dt-group">/);
});

test('column add/remove: at MAX_BIKES the + Add header is gone', () => {
  const bikes = Array.from({ length: MAX_BIKES }, (_, i) => blankBike(i));
  const html = renderDataTable({ values: defaultValues(), bikes, lang: 'en' });
  assert.doesNotMatch(html, /onclick="addBike\(\)"/);
  // group header colspan = 1 + 5 = 6
  assert.match(html, /colspan="6"/);
});

test('blankBike: returns a usable bike with INPUT_META defaults', () => {
  const b = blankBike(7);
  assert.ok(b.id);
  assert.equal(typeof b.name, 'string');
  assert.ok(b.values && Number.isFinite(b.values.WB));
  assert.deepEqual(b.components, {});
});

test('numeric input rows render <input type="number"> cells per bike', () => {
  const html = render();
  // Yoke_Offset row should produce 3 number inputs
  const matches = html.match(/oninput="setBikeInput\(\d+, 'Yoke_Offset'/g) || [];
  assert.equal(matches.length, 3);
});

test('component rows render <select> wired to setBikeComponent', () => {
  const html = render();
  for (const c of ['clamp', 'fork', 'shock', 'swingarm', 'linkage']) {
    assert.match(html, new RegExp(`onchange="setBikeComponent\\(\\d+, '${c}'`),
      `missing component select for ${c}`);
  }
  // datalists are gone — no more text-input profile cells
  assert.doesNotMatch(html, /id="dt-options-/);
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

test('every ROW_GROUPS row has at least one of input/computed/component/literal/derivedFrom', () => {
  for (const g of ROW_GROUPS) for (const r of g.rows) {
    const has = r.input != null || r.computed != null || r.component != null
             || r.literal != null || r.derivedFrom != null;
    assert.ok(has, `row "${r.spec}" has no value source`);
  }
});

test('H3: frame-intrinsic input rows exist in ROW_GROUPS', () => {
  const allRows = ROW_GROUPS.flatMap(g => g.rows);
  for (const k of ['front_weight_dist', 'rear_weight_dist', 'C_f_aero', 'C_r_aero']) {
    assert.ok(allRows.some(r => r.input === k), `missing input row for ${k}`);
  }
});

test('Dynamic-only rows are removed from RESULTS (static-first mode)', () => {
  // While the dynamic phase is offline, rows that inherently need
  // Travel_Front / Travel_Rear / a_x / V / Cd / A — i.e. wheel-vertical
  // travel and the front/rear wheel forces — are dropped from the table.
  // They will return when the dynamic-load pipeline is re-wired.
  const allRows = ROW_GROUPS.flatMap(g => g.rows);
  for (const id of ['MotoSPEC_FrontForce', 'MotoSPEC_RearForce', 'Rear_Wheel_Vertical_Travel']) {
    assert.ok(!allRows.some(r => r.computed === id),
      `Expected ${id} row to be removed from RESULTS while dynamic is offline`);
  }
});

test('defaultBikes seeds three neutral placeholder bikes', () => {
  const bikes = defaultBikes();
  assert.equal(bikes.length, 3);
  for (const b of bikes) {
    assert.ok(b.id);
    assert.ok(b.name);
    assert.ok(b.values);
    assert.ok(b.components, 'bike must carry a components dict (may be empty)');
    // Bikes no longer carry a `preset` field — values come only from
    // chassis / linkage / component selections, not from hard-coded preset
    // injections.
    assert.equal(b.preset, undefined);
  }
});

test('Wheel Rate rows reflect real formulas (no PENDING status)', () => {
  const results = ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const fr = results.find(r => r.computed === 'Front_Wheel_Rate');
  const rr = results.find(r => r.computed === 'Rear_Wheel_Rate');
  // Both wheel-rate rows use real formulas — no status badge. The
  // missing-input system handles the linkage-coordinate concern by
  // blanking the cell when no linkage is bound.
  assert.equal(fr.status, undefined);
  assert.equal(rr.status, undefined);
});
