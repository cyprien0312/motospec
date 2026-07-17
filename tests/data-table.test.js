import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, ROW_GROUPS, defaultBikes, blankBike, MAX_BIKES,
         SETUP_OVERRIDABLE, effectiveBikeValues } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';
import { setCatalogEntry, resetUserOverlay } from '../src/catalog.js';

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
  // Front_Spring_Rate is component-domain (forks) — still typeable.
  const matches = html.match(/oninput="setBikeInput\(\d+, 'Front_Spring_Rate'/g) || [];
  assert.equal(matches.length, 3);
});

test('chassis-domain rows are not editable without a chassis profile', () => {
  const html = render();
  // Without a selected chassis there is no `*_ref` baseline, so the
  // SETUP_OVERRIDABLE keys must not render editable cells — an override
  // diffed against placeholder defaults would be fake data. (The
  // MASS_OVERRIDABLE keys are exempt: no ref coupling — see below.)
  for (const key of ['Yoke_Offset', 'Fork_Position', 'Swingarm_Length',
                     'rear_weight_dist', 'C_f_aero', 'C_r_aero']) {
    assert.doesNotMatch(html, new RegExp(`setBikeInput\\(\\d+, '${key}'`),
      `${key} must not be editable without a chassis profile`);
  }
});

// A minimal but complete chassis profile for the setup-override tests.
const TEST_CHASSIS_SPECS = {
  Rake_Static: 23.7, WB: 1414.3, Swingarm_Length: 594.5, beta_static: 12.23,
  Yoke_Offset: 26, Fork_Position: 28,
  Fork_Position_ref: 28, Shock_Length_ref: 283,
  Swingarm_Length_ref: 594.5, Yoke_Offset_ref: 26, Rf: 304.6,
};

function withTestChassis(fn) {
  resetUserOverlay();
  try {
    setCatalogEntry('chassis', 'test-chassis', { name: 'Test Chassis', specs: { ...TEST_CHASSIS_SPECS } });
    const bike = { ...blankBike(0), components: { chassis: 'test-chassis' }, overrides: {} };
    return fn(bike);
  } finally {
    resetUserOverlay();
  }
}

test('setup keys become editable inputs once a chassis profile is selected', () => {
  withTestChassis((bike) => {
    const html = renderDataTable({ values: defaultValues(), bikes: [bike], lang: 'en' });
    for (const key of SETUP_OVERRIDABLE) {
      assert.match(html, new RegExp(`setBikeInput\\(0, '${key}'`),
        `${key} should be editable when a chassis profile is bound`);
    }
    // Profile value pre-fills the cell; no override yet → no accent class.
    assert.doesNotMatch(html, /dt-input-override/);
  });
});

test('setup override feeds compute only when layered on a chassis profile', () => {
  // Without a chassis: the override is ignored (no baseline to diff against).
  const orphan = { ...blankBike(1), components: {}, overrides: { Yoke_Offset: 40 } };
  assert.equal(effectiveBikeValues(orphan).Yoke_Offset, defaultValues().Yoke_Offset,
    'setup override must be ignored without a chassis profile');

  withTestChassis((bike) => {
    bike.overrides.Yoke_Offset = 29;      // setup key → applies
    bike.overrides.Rake_Static = 60;      // measurement key → still ignored
    const v = effectiveBikeValues(bike);
    assert.equal(v.Yoke_Offset, 29, 'setup override must apply on top of the profile');
    assert.equal(v.Rake_Static, TEST_CHASSIS_SPECS.Rake_Static,
      'non-setup chassis keys must remain profile-defined');
    // The ref baseline is untouched — the delta chain diffs 29 vs 26.
    assert.equal(v.Yoke_Offset_ref, TEST_CHASSIS_SPECS.Yoke_Offset_ref);
  });
});

test('diverging setup cell carries the override accent class and restore hint', () => {
  withTestChassis((bike) => {
    bike.overrides.Fork_Position = 31;
    const html = renderDataTable({ values: defaultValues(), bikes: [bike], lang: 'en' });
    assert.match(html, /dt-input-override/);
    assert.match(html, /Overriding chassis profile value 28/);
  });
});

test('component rows render <select> wired to setBikeComponent', () => {
  const html = render();
  for (const c of ['fork', 'shock', 'linkage']) {
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

test('FRAME GEOMETRY carries only the chassis selector — echo rows removed', () => {
  // Chassis geometry is defined in Chassis Setup, full stop. The aero echo
  // rows and the CofG pseudo-results are gone (an echo dressed as a result
  // is what the honesty rules forbid). The mass picture returned as
  // EDITABLE measurement rows (MASS & CG group) — not echoes — and only
  // the front share renders (rear auto-derives).
  const allRows = ROW_GROUPS.flatMap(g => g.rows);
  for (const k of ['rear_weight_dist', 'C_f_aero', 'C_r_aero']) {
    assert.ok(!allRows.some(r => r.input === k), `echo row for ${k} should be removed`);
  }
  const frame = ROW_GROUPS.find(g => g.header === 'FRAME GEOMETRY');
  assert.equal(frame.rows.length, 1);
  assert.equal(frame.rows[0].component, 'chassis');
  assert.ok(!allRows.some(r => /CofG/.test(r.spec)), 'CofG echo rows should be removed');
  const mass = ROW_GROUPS.find(g => g.header === 'MASS & CG');
  for (const k of ['Mass', 'H_CG', 'L_CG', 'front_weight_dist']) {
    assert.ok(mass.rows.some(r => r.input === k), `MASS & CG should carry an editable ${k} row`);
  }
});

test('mass keys are editable without a chassis and the override is real', () => {
  // No ref coupling → typed measurements stand on their own.
  const html = render();
  for (const k of ['Mass', 'H_CG', 'L_CG', 'front_weight_dist']) {
    const cells = html.match(new RegExp(`oninput="setBikeInput\\(\\d+, '${k}'`, 'g')) || [];
    assert.equal(cells.length, 3, `${k} should render an editable cell per bike even without a chassis`);
  }
  const bike = { ...blankBike(0), components: {}, overrides: { Mass: 172, front_weight_dist: 0.51 } };
  const v = effectiveBikeValues(bike);
  assert.equal(v.Mass, 172);
  assert.equal(v.front_weight_dist, 0.51);
  assert.equal(v.rear_weight_dist, 0.49, 'rear share must auto-derive from the typed front share');
});

test('LOAD CASE group renders editable sag inputs that default to 0 (always ready)', () => {
  const html = render();
  assert.match(html, /LOAD CASE/);
  for (const k of ['Sag_Front', 'Sag_Rear']) {
    const cells = html.match(new RegExp(`oninput="setBikeInput\\(\\d+, '${k}'`, 'g')) || [];
    assert.equal(cells.length, 3, `${k} should render one editable cell per bike`);
  }
  // 0 is a real value — sag cells must not render as missing-input cells.
  const sagRow = html.match(/<tr><th class="dt-spec">Front Sag[\s\S]*?<\/tr>/)[0];
  assert.doesNotMatch(sagRow, /dt-input-missing/);
  assert.match(sagRow, /value="0"/);
});

test('RESULTS has a single live block — no STATIC badges, wheelbase is computed', () => {
  const results = ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  for (const r of results) {
    assert.notEqual(r.status, 'static', `${r.spec} still carries the retired STATIC badge`);
    assert.ok(r.computed, `${r.spec} should be a computed channel, not an echo`);
  }
  assert.ok(results.some(r => r.computed === 'Wheelbase_Live'),
    'Wheelbase row must consume the live channel, not echo WB');
  assert.ok(!results.some(r => r.computed === 'WB'));
});

test('gating: live rows blank without chassis+linkage, even though sag is always ready', () => {
  // Default bikes bind nothing — the Rake cell must render as a
  // missing-input hint (needs chassis + fork + shock + linkage), NOT as a
  // number built from placeholder defaults, and NOT blame the sag inputs.
  const html = render();
  const rakeRow = html.match(/<tr><th class="dt-spec">Rake \(degrees\)[\s\S]*?<\/tr>/)[0];
  assert.match(rakeRow, /dt-missing/);
  assert.match(rakeRow, /Need:/);
  assert.doesNotMatch(rakeRow, /Sag_/, 'sag inputs are real at 0 and must never be reported missing');
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

test('collapsible groups: collapsed group hides its rows but keeps a clickable header', () => {
  const html = render({ dtCollapsed: { 'FRONT SETTINGS': true } });
  // Header still renders, with caret + hidden-row count, wired to the toggle.
  assert.match(html, /toggleDtGroup\('FRONT SETTINGS'\)/);
  assert.match(html, /▸/);
  const front = ROW_GROUPS.find(g => g.header === 'FRONT SETTINGS');
  assert.match(html, new RegExp(`\\(${front.rows.length}\\)`));
  // Rows inside the collapsed group are gone…
  assert.doesNotMatch(html, /setBikeInput\(\d+, 'Front_Spring_Rate'/);
  // …while other groups still render theirs.
  assert.match(html, /setBikeInput\(\d+, 'Rear_Spring_Rate'/);
});

test('collapsible groups: default state renders everything expanded', () => {
  const html = render();
  assert.doesNotMatch(html, /▸/, 'no group should start collapsed');
  const carets = html.match(/▾/g) || [];
  assert.equal(carets.length, ROW_GROUPS.length, 'every group header carries an expanded caret');
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
