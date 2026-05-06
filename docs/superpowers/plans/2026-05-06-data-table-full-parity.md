# DATA TABLE — Full MotoSpec Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "DATA TABLE" page mirroring `motospec-style-table.csv` (parameter column + three reference bikes + a live "Current" column), and implement every result row to match MotoSpec output within published tolerance — including the linkage geometry, spring-to-wheel-rate translation, dynamic wheelbase under combined fork compression + lean angle, and trail correction under lean.

**Architecture:** Extend `src/formulas.js`'s registry with sub-modules: `src/linkage.js` (4-bar kinematics → motion ratio function and progression), `src/springs.js` (spring → wheel rate), `src/lean.js` (lean-angle corrections to trail and wheelbase), `src/drivetrain.js` (sprocket math). `src/reference-bikes.js` holds the three CSV bikes as a typed constant. The DATA TABLE page lives in `src/data-table.js` (rendering only, no formulas), invoked from a new sidebar nav item. `index.html` adds a route case to call into the new renderer. All physics modules are pure ES, browser + Node compatible. Tests parallel each module under `tests/`. Final cross-validation runs every reference bike through every result and compares against the CSV row-by-row with documented tolerances.

**Tech Stack:** Vanilla ES modules (no bundler, no deps), Node ≥18 built-in `node:test`. Numerical 4-bar linkage closure solved via Newton-Raphson on a single-variable residual (closed-form is messy; iterative is small + clear). All HTML/CSS/JS hand-rolled to match existing aesthetic.

**Phasing:** This plan is structured in 7 phases (A–G). Each phase is independently shippable — at the end of every phase the app boots, tests pass, and the table shows more populated rows than before.

- **Phase A** — Skeleton page + currently-computable rows (3 tasks; ~half day)
- **Phase B** — Drivetrain (1 task; ~1 hour)
- **Phase C** — Linkage geometry (5 tasks; ~2 days; the critical path)
- **Phase D** — Spring system + Front Wheel Rate research (3 tasks; ~1 day; gated by research task)
- **Phase E** — Dynamic wheelbase under load (2 tasks; ~half day)
- **Phase F** — Lean-angle corrections (3 tasks; ~1 day; deferable)
- **Phase G** — Cross-validation harness (2 tasks; ~half day)

Total: ~5–7 working days of implementation + research time for the FWR formula.

**Design decisions locked in (per user, 2026-05-06):**
1. **Linkage modeling:** full geometry (Phase C) — user enters linkage coordinates, motion ratio is computed as a function of swingarm angle, not a scalar input.
2. **Front Wheel Rate:** display `—` with note pending research; Phase D includes an explicit research task before any formula is committed.
3. **Lean-angle effects:** Phase F deferred — the page must be shippable through Phase E without lean; lean column is a stub that doesn't drive formulas in Phase E.

---

## File Structure

**Create:**
- `src/reference-bikes.js` — three CSV bikes encoded as a typed constant; one source of truth used by the table and the validation harness.
- `src/drivetrain.js` — `finalRatio(front, rear)` and any future drivetrain math.
- `src/linkage.js` — 4-bar linkage closure + `motionRatio(state, swingarmAngle)` + `progression(state)` + `rearRideHeight(state)` + `rearWheelVerticalTravel(state)`.
- `src/springs.js` — `rearWheelRate(state)`; `frontWheelRate(state)` placeholder + research note.
- `src/lean.js` — `trailUnderLean(rake, trail, lean)` and `wheelbaseUnderLean(wb, lean)` (Phase F).
- `src/data-table.js` — `renderDataTable()` produces the page DOM; consumed by index.html.
- `tests/linkage.test.js`, `tests/springs.test.js`, `tests/drivetrain.test.js`, `tests/lean.test.js`, `tests/data-table.test.js`, `tests/full-parity.test.js`.
- `docs/research/front-wheel-rate.md` — research note (Phase D Task 1).

**Modify:**
- `src/formulas.js` — register new params (`Final_Ratio`, `Rear_Wheel_Rate`, `Front_Wheel_Rate`, `Motion_Ratio`, `Progression`, `Rear_Ride_Height`, `Rear_Wheel_Vertical_Travel`); add ~12 new inputs (linkage coords, spring rates, sprockets, shock dimensions, lean). Wire computeAll to delegate to the new sub-modules.
- `index.html` — sidebar gains `Data Table` nav item; route `__datatable` to `src/data-table.js#renderDataTable`. Existing dashboard untouched.
- `tests/fixtures/reference-bikes.json` — extend each bike's `inputs` block with the new fields; populate `expected.motospec` from the CSV's RESULTS section.

---

## Reference Bikes — single source of truth

Phase A Task 1 creates `src/reference-bikes.js` with the three CSV bikes encoded once. The DATA TABLE page reads from it (left columns = static reference data); the validation harness reads from it (cross-check inputs); tests in every later phase pin numeric expectations against its `expected` blocks.

```js
// src/reference-bikes.js
export const REFERENCE_BIKES = [
  {
    id: 'r7',
    name: 'Yamaha R7 (2022)',
    inputs: { /* every input including linkage coords, spring rates, sprockets */ },
    dynamic_presets: {
      sag:        { Travel_Front: 30,  Travel_Rear: 10, Lean_Angle: 0  },
      braking:    { Travel_Front: 120, Travel_Rear: 2,  Lean_Angle: 0  },
      mid_corner: { Travel_Front: 80,  Travel_Rear: 20, Lean_Angle: 55 },
    },
    expected: {
      sag:        { Rake: 24.27, Trail: 97.8,  Rear_Travel: 25.2,  Rear_RHR: -77.6, Swingarm_Angle: -8.37, AntiSquat: 109.2, Progression: 16.9, MotionRatio: 2.488, Wheelbase: 1403.5, FWR: 33.74, RWR: 18.97, FWF: 754.9,  RWF: 1151.3, COG_Front: 44.6, COG_Rear: 55.4 },
      braking:    { Rake: 21.09, Trail: 84.3,  Rear_Travel: 5.3,   Rear_RHR: -63.4, Swingarm_Angle: -6.21, AntiSquat:  98.8, Progression: 34.0, MotionRatio: 2.672, Wheelbase: 1430.9, FWR: 28.96, RWR: 45.91, FWF: 2801.6, RWF: 469.2,  COG_Front: 53.6, COG_Rear: 46.4 },
      mid_corner: { Rake: 21.13, Trail: 76.7,  Rear_Travel: 52.0,  Rear_RHR: -46.3, Swingarm_Angle: -4.86, AntiSquat:  88.3, Progression:  5.2, MotionRatio: 2.584, Wheelbase: 1360.7, FWR: 31.85, RWR: 24.61, FWF: 2087.8, RWF: 1781.3, COG_Front: 52.4, COG_Rear: 47.6 },
    },
  },
  // ...gsx8r, rs660 with the same shape
];
```

**Important:** the expected values are the SAME `expected.X` block per bike but indexed by preset. The CSV doesn't actually give us multiple "expected" outputs per bike — it gives one set per dynamic preset. Each bike has three columns of expected outputs (sag/braking/mid-corner). Validation tests assert per-(bike, preset).

---

# Phase A — Skeleton page + currently-computable rows

Goal at end of Phase A: clicking "Data Table" in the sidebar shows a 5-column table with all CSV rows as parameter labels, three reference bikes pre-filled with verbatim CSV values, and the "Current" column showing live values for the ~7 rows we already compute (Rake, Ground Trail, Swingarm Angle, AntiSquat, Wheelbase, Front/Rear Wheel Force, COG %). Other rows show `—`. Tests confirm the table renders and the live column updates when state changes.

## Task A1: Encode reference bikes

**Files:**
- Create: `src/reference-bikes.js`
- Create: `tests/reference-bikes.test.js`

- [ ] **Step 1: Write failing test for shape**

```js
// tests/reference-bikes.test.js
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
      assert.ok(b.expected[preset],          `${b.id} missing expected.${preset}`);
    }
  }
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm test`
Expected: 2 fails — module not found.

- [ ] **Step 3: Create `src/reference-bikes.js` with the full encoding**

Encode every input and every expected value from the CSV verbatim, for all three bikes × three presets. The full structure (truncated for brevity):

```js
export const REFERENCE_BIKES = [
  {
    id: 'r7',
    name: 'Yamaha R7 (2022)',
    fork_name: 'FGK242',
    shock_name: 'YA 589',
    swingarm_name: 'Yamaha R7 2022',
    link_name: 'R7',
    front_tire: 'Pir SBK 120/70',
    rear_tire: 'Pir SBK 180/60',
    inputs: {
      // ===== Front =====
      Yoke_Offset: 35, Fork_Position: 5,
      Front_Spring_Rate: 9.0, Front_Spring_Preload: 10.0,
      Front_Oil_Level: 170.0, Front_Topout_Rate: 4.0, Front_Topout_Length: 40.0,
      // ===== Rear =====
      Swingarm_Length: 533, Shock_Clevis_RHA: 0, Shock_Length: 310,
      Rear_Spring_Rate: 110, Rear_Spring_Preload: 14,
      Rear_Topout_Rate: 188, Rear_Topout_Length: 8,
      Linkarm_Length: 92,
      // ===== Drivetrain =====
      Front_Sprocket: 16, Rear_Sprocket: 42,
      // ===== Existing inputs we keep =====
      Rake_Static: 24.27,    // CSV reports Rake at sag, used as Static here
      Mass: 280,             // approx; CSV doesn't give wet+rider, see note
      Rf: 308, O: 35,
      // ===== Linkage coordinates (Phase C uses these) =====
      // Origin = swingarm pivot. Right and up positive.
      Frame_Rocker_Pivot_X: -50, Frame_Rocker_Pivot_Y: 80,
      Rocker_To_Shock_X:    -65, Rocker_To_Shock_Y:    100,
      Rocker_To_Drag_X:     -45, Rocker_To_Drag_Y:     60,
      Drag_To_Swingarm_X:    40, Drag_To_Swingarm_Y:    -10,
      Frame_Shock_Top_X:    -200, Frame_Shock_Top_Y:    300,
    },
    dynamic_presets: {
      sag:        { Travel_Front: 30,  Travel_Rear: 10, Lean_Angle: 0  },
      braking:    { Travel_Front: 120, Travel_Rear: 2,  Lean_Angle: 0  },
      mid_corner: { Travel_Front: 80,  Travel_Rear: 20, Lean_Angle: 55 },
    },
    expected: {
      sag:        { Rake: 24.27, Trail: 97.8,  Rear_Travel: 25.2,  Rear_RHR: -77.6, Swingarm_Angle: -8.37, AntiSquat: 109.2, Progression: 16.9, MotionRatio: 2.488, Wheelbase: 1403.5, FWR: 33.74, RWR: 18.97, FWF: 754.9,  RWF: 1151.3, COG_Front: 44.6, COG_Rear: 55.4 },
      braking:    { Rake: 21.09, Trail: 84.3,  Rear_Travel: 5.3,   Rear_RHR: -63.4, Swingarm_Angle: -6.21, AntiSquat:  98.8, Progression: 34.0, MotionRatio: 2.672, Wheelbase: 1430.9, FWR: 28.96, RWR: 45.91, FWF: 2801.6, RWF: 469.2,  COG_Front: 53.6, COG_Rear: 46.4 },
      mid_corner: { Rake: 21.13, Trail: 76.7,  Rear_Travel: 52.0,  Rear_RHR: -46.3, Swingarm_Angle: -4.86, AntiSquat:  88.3, Progression:  5.2, MotionRatio: 2.584, Wheelbase: 1360.7, FWR: 31.85, RWR: 24.61, FWF: 2087.8, RWF: 1781.3, COG_Front: 52.4, COG_Rear: 47.6 },
    },
  },
  // GSX-8R (2024) — populate using CSV column 2; same structure
  // RS 660 (2025) — populate using CSV column 3
];
```

> **Engineer note:** the `Linkage coordinates` block above is a placeholder estimate — CSV does NOT provide them. They need real values from each bike's service manual or trustworthy aftermarket sources before Phase C tests pass. Until then, leave the placeholder; Phase C Task 1 explicitly addresses sourcing the real numbers. **Do not invent coordinates that match the CSV's MotionRatio output by reverse-engineering from the result** — that defeats the purpose of independent validation.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/reference-bikes.js tests/reference-bikes.test.js
git commit -m "feat: encode three reference bikes from motospec-style-table.csv"
```

## Task A2: Add new param registry entries (stubs only)

Goal: define every CSV-derived param (input + computed) in `P` so the existing dashboard auto-discovers them, but compute functions for new things either stub to NaN or to the simplest correct math (Final_Ratio is real; everything else stubs `NaN` until its phase). This lets the DATA TABLE in Task A3 wire to a real registry instead of inventing labels.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Write failing tests for new param ids in P**

Append to `tests/formulas.test.js`:

```js
const NEW_INPUTS = [
  'Yoke_Offset', 'Fork_Position', 'Front_Spring_Rate', 'Front_Spring_Preload',
  'Front_Oil_Level', 'Front_Topout_Rate', 'Front_Topout_Length',
  'Swingarm_Length', 'Shock_Clevis_RHA', 'Shock_Length',
  'Rear_Spring_Rate', 'Rear_Spring_Preload', 'Rear_Topout_Rate', 'Rear_Topout_Length',
  'Linkarm_Length',
  'Front_Sprocket', 'Rear_Sprocket',
  'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
  'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
  'Lean_Angle',
];
const NEW_COMPUTED = [
  'Final_Ratio', 'Motion_Ratio', 'Progression', 'Rear_Ride_Height',
  'Rear_Wheel_Vertical_Travel', 'Rear_Wheel_Rate', 'Front_Wheel_Rate',
];

for (const id of NEW_INPUTS) {
  test(`new input ${id} registered`, () => {
    assert.ok(P[id], `${id} missing from P`);
    assert.equal(P[id].type, 'input');
    assert.ok(INPUT_META[id], `${id} missing INPUT_META`);
  });
}
for (const id of NEW_COMPUTED) {
  test(`new computed ${id} registered`, () => {
    assert.ok(P[id], `${id} missing from P`);
    assert.notEqual(P[id].type, 'input');
    assert.equal(typeof CALC[id], 'function');
  });
}
```

- [ ] **Step 2: Confirm failures via npm test**

- [ ] **Step 3: Add the registry entries to `src/formulas.js`**

For each entry in `NEW_INPUTS`, add to `P` with `type:'input'`, label/desc/unit/source/typical, and to `INPUT_META` with sane def/min/max/step. For each entry in `NEW_COMPUTED`, add to `P` with `type:'channel'` (for the headline rows: Final_Ratio is intermediate; Motion_Ratio, Progression, Rear_Ride_Height, Rear_Wheel_Vertical_Travel are intermediates; Rear_Wheel_Rate, Front_Wheel_Rate are channels — group as you prefer, keep dashboard sane), with formula tokens describing the formula at a glance, deps array, and CALC entries:

```js
// src/formulas.js (additions to CALC)
Final_Ratio: v => v.Rear_Sprocket / v.Front_Sprocket,
Motion_Ratio: v => NaN,                        // Phase C
Progression: v => NaN,                         // Phase C
Rear_Ride_Height: v => NaN,                    // Phase C
Rear_Wheel_Vertical_Travel: v => NaN,          // Phase C
Rear_Wheel_Rate: v => NaN,                     // Phase D
Front_Wheel_Rate: v => NaN,                    // Phase D research
```

Update `TOPO_ORDER` to include all 7 new computed ids in dependency order. Final_Ratio depends only on inputs, so it can go first; the rest can go anywhere since they currently return NaN. Tests asserting `Number.isFinite` should be relaxed for known-stub ids — see Step 4.

- [ ] **Step 4: Update `computeAll on defaults returns finite values for all params` test**

Allow stubbed-NaN returns explicitly so the test still pins everything else:

```js
// tests/formulas.test.js
const KNOWN_STUB_NAN = new Set([
  'Motion_Ratio', 'Progression', 'Rear_Ride_Height',
  'Rear_Wheel_Vertical_Travel', 'Rear_Wheel_Rate', 'Front_Wheel_Rate',
]);

test('computeAll on defaults returns finite values for all non-stub params', () => {
  const out = computeAll(defaultValues());
  for (const id in P) {
    if (KNOWN_STUB_NAN.has(id)) continue;
    assert.ok(Number.isFinite(out[id]), `${id} = ${out[id]} not finite`);
  }
});
```

Each subsequent phase that implements one of the stubs MUST also delete it from `KNOWN_STUB_NAN` in the same commit — that's the test that proves the stub is gone.

- [ ] **Step 5: Run tests, expect pass**

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: register linkage / spring / drivetrain params (stubs returning NaN)"
```

## Task A3: DATA TABLE page

**Files:**
- Create: `src/data-table.js`
- Create: `tests/data-table.test.js`
- Modify: `index.html`

- [ ] **Step 1: Define ROW_GROUPS (what the table displays, in CSV order)**

```js
// src/data-table.js
export const ROW_GROUPS = [
  { header: 'FRONT SETTINGS', rows: [
    { spec: 'Clamp/Yoke Name',  input: null,                ref: 'fork_name'   /* string from REFERENCE_BIKES, not from P */ },
    { spec: 'Yoke Offset (mm)', input: 'Yoke_Offset',       ref: null },
    { spec: 'Fork Position (mm)', input: 'Fork_Position',   ref: null },
    // ... cover every CSV row
  ]},
  { header: 'REAR SETTINGS', rows: [/*…*/] },
  { header: 'TIRES',         rows: [/*…*/] },
  { header: 'SPROCKETS',     rows: [/*…*/] },
  { header: 'DYNAMIC READINGS', rows: [/*…*/] },
  { header: 'RESULTS', rows: [
    { spec: 'Rake (degrees)',           computed: 'MotoSPEC_Rake' },
    { spec: 'Ground Trail (mm)',        computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Wheel Vertical Travel (mm)', computed: 'Rear_Wheel_Vertical_Travel' },
    { spec: 'Rear Ride Height Reference (mm)', computed: 'Rear_Ride_Height' },
    { spec: 'Swingarm Angle (degrees)', computed: 'MotoSPEC_SwgarmAngl' },
    { spec: 'AntiSquat : Percent',      computed: 'MotoSPEC_AntSquat' },
    { spec: 'Progression : Full Shock Travel (%)', computed: 'Progression' },
    { spec: 'Motion Ratio : Wheel/Shock', computed: 'Motion_Ratio' },
    { spec: 'Wheelbase (mm)',           computed: 'WB' /* Phase E will switch to dynamic computeAll value */ },
    { spec: 'Front Wheel Rate (N/mm)',  computed: 'Front_Wheel_Rate' },
    { spec: 'Rear Wheel Rate (N/mm)',   computed: 'Rear_Wheel_Rate' },
    { spec: 'Front Wheel Force (N)',    computed: 'MotoSPEC_FrontForce' },
    { spec: 'Rear Wheel Force (N)',     computed: 'MotoSPEC_RearForce' },
    { spec: 'CofG % Front',             computed: 'front_weight_dist', formatPercent: true },
    { spec: 'CofG % Rear',              computed: 'rear_weight_dist',  formatPercent: true },
  ]},
];
```

- [ ] **Step 2: Write `renderDataTable(state)` — produces HTML string**

```js
// src/data-table.js
import { REFERENCE_BIKES } from './reference-bikes.js';
import { computeAll, P } from './formulas.js';

const PRESETS = ['sag', 'braking', 'mid_corner'];

export function renderDataTable(state) {
  // Compute "Current" column once
  const current = computeAll(state.values);

  // Compute reference column for each bike × default preset (sag).
  // Phase A only shows ONE preset per bike to keep table 5 cols wide.
  const refOuts = REFERENCE_BIKES.map(b => {
    const inputs = { ...b.inputs, ...b.dynamic_presets.sag };
    return { bike: b, out: computeAll(inputs) };
  });

  let html = `<div class="dt-wrap"><table class="dt"><thead><tr>
    <th class="dt-spec">参数 / Parameter</th>
    ${refOuts.map(r => `<th>${escapeHtml(r.bike.name)}</th>`).join('')}
    <th class="dt-current">Current</th>
  </tr></thead><tbody>`;

  for (const group of ROW_GROUPS) {
    html += `<tr class="dt-group"><td colspan="5">${escapeHtml(group.header)}</td></tr>`;
    for (const row of group.rows) {
      html += `<tr>
        <td class="dt-spec">${escapeHtml(row.spec)}</td>
        ${refOuts.map(r => `<td>${cellValueFromBike(r, row)}</td>`).join('')}
        <td class="dt-current">${cellValueFromCurrent(current, state.values, row)}</td>
      </tr>`;
    }
  }
  return html + `</tbody></table></div>`;
}

function cellValueFromBike(refOut, row) { /* picks bike.inputs[row.input] OR bike.expected.sag[row.computed] OR REFERENCE_BIKES bike[row.ref] for string fields */ }
function cellValueFromCurrent(out, values, row) { /* picks values[row.input] OR formats out[row.computed]; '—' if NaN */ }
```

Show `—` for `NaN` computed values. Show `—` for bike rows where the reference's `expected[preset]` doesn't have a key for that row.

- [ ] **Step 3: Add CSS to `<style>` in index.html for `.dt`**

Stripe rows, sticky first column, group headers in accent color. Reuse existing CSS variables for theme consistency.

- [ ] **Step 4: Wire into navigation**

In `index.html`'s sidebar, add a nav item for `__datatable` next to `__dashboard`. In `renderContent`, route `id === '__datatable'` to `renderDataTable(state)`. Add the page id to allowed values in `navigateRoot` / `navigateTo`.

- [ ] **Step 5: Tests for the renderer**

```js
// tests/data-table.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, ROW_GROUPS } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';

test('table contains every CSV group header', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const expected of ['FRONT SETTINGS', 'REAR SETTINGS', 'TIRES', 'SPROCKETS', 'DYNAMIC READINGS', 'RESULTS']) {
    assert.match(html, new RegExp(expected));
  }
});

test('table contains every reference bike name', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const expected of ['Yamaha R7', 'Suzuki GSX-8R', 'Aprilia RS 660']) {
    assert.match(html, new RegExp(expected));
  }
});

test('NaN computed cells render as em-dash', () => {
  const html = renderDataTable({ values: defaultValues() });
  assert.match(html, /—/);
});

test('every ROW_GROUPS row has either input, computed, or ref key', () => {
  for (const g of ROW_GROUPS) for (const r of g.rows) {
    const has = r.input != null || r.computed != null || r.ref != null;
    assert.ok(has, `row "${r.spec}" has none of input/computed/ref`);
  }
});
```

- [ ] **Step 6: Verify in browser** (controller smoke)

Reload. Click the new "Data Table" nav. Expected: table renders with three pre-filled bike columns, group headers, and a Current column showing `—` for everything except the 7 currently-computed result rows.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat: data table page skeleton with currently-computable result rows"
```

---

# Phase B — Drivetrain (Final Ratio)

## Task B1: Wire `Final_Ratio = Rear_Sprocket / Front_Sprocket` and validate

Already wired in Task A2 Step 3. This task adds a numeric pin and removes Final_Ratio from `KNOWN_STUB_NAN` (it isn't in the stub list because the formula is real, but verify).

**Files:**
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Add pin tests for each reference bike**

```js
import { REFERENCE_BIKES } from '../src/reference-bikes.js';
test('Final_Ratio matches CSV for each reference bike', () => {
  for (const b of REFERENCE_BIKES) {
    const out = computeAll({ ...defaultValues(), ...b.inputs });
    const expected = b.inputs.Rear_Sprocket / b.inputs.Front_Sprocket;
    assert.ok(Math.abs(out.Final_Ratio - expected) < 1e-9, `${b.id}: got ${out.Final_Ratio}, expected ${expected}`);
  }
});
```

CSV reports R7=2.625, GSX=2.765, RS660=2.529. After this test passes, those numbers must show up in the DATA TABLE's bike columns.

- [ ] **Step 2: Run, commit**

```bash
git commit -am "test: pin Final_Ratio against reference bikes"
```

---

# Phase C — Linkage geometry (the critical path)

Goal: implement a 4-bar suspension linkage solver that computes `Motion_Ratio`, `Progression`, `Rear_Ride_Height`, and `Rear_Wheel_Vertical_Travel` from the linkage coordinate inputs and the current shock state. Match CSV values for all three reference bikes within ±5% (we cannot be tighter without manufacturer linkage drawings).

This is the hardest physics in the plan. Tasks are ordered: pure-math kernel first, then registry wiring, then validation.

## Task C1: Source real linkage coordinates for the three reference bikes

**This is a research task, not a coding task.** The placeholder coordinates in Task A1 will produce nonsense Motion Ratios. Real coordinates come from one of:

1. Service-manual exploded views with measurements.
2. Aftermarket linkage replacement spec sheets (Lightech, Bonamici, etc. publish geometry for the bikes they make parts for).
3. CAD models from owner forums.
4. Direct measurement from a workshop bike.

- [ ] **Step 1: For each reference bike, document the source and record real coordinates**

Create `docs/research/linkage-coords.md`:
```markdown
# Reference-bike linkage coordinates

All coordinates are in mm, with origin at the swingarm pivot, +X forward, +Y up.

## Yamaha R7 (2022)
Source: <citation, e.g. Yamaha service manual page X / aftermarket part datasheet>
- Frame_Rocker_Pivot:   (Px, Py)
- Rocker_To_Shock:      (Sx, Sy)
- Rocker_To_Drag:       (Dx, Dy)
- Drag_To_Swingarm:     (Tx, Ty)
- Frame_Shock_Top:      (Mx, My)

## Suzuki GSX-8R (2024)
Source: ...

## Aprilia RS 660 (2025)
Source: ...
```

If real coordinates cannot be found for a bike, document that explicitly and exclude that bike from Phase C numeric pin tests; instead exercise Phase C only with the bikes whose coords are real.

- [ ] **Step 2: Update `src/reference-bikes.js` with the real coordinates**

- [ ] **Step 3: Commit**

```bash
git commit -am "research: source real linkage coordinates for reference bikes"
```

## Task C2: 4-bar linkage closure kernel

A 4-bar linkage in motorcycle rear suspension has links: (1) frame from rocker pivot to swingarm pivot, (2) swingarm from pivot to drag-link bolt, (3) drag link, (4) rocker arm from drag bolt to rocker pivot. Given swingarm angle β, find rocker angle φ that closes the loop.

**Files:**
- Create: `src/linkage.js`
- Create: `tests/linkage.test.js`

- [ ] **Step 1: Write failing tests with synthetic linkage geometry**

A test linkage where you know the answer by construction:
- Frame_Rocker_Pivot at (-100, 100)
- Drag_To_Swingarm at (50, 0) — so swingarm-pivot-to-drag arm has length 50, angle 0°
- Rocker_To_Drag at (-50, 50) — so frame-pivot-to-drag arm has length √(50² + 50²) ≈ 70.71, angle 135° from +X
- Drag-link length is √((50-(-50))² + (0-50)²) = √(100²+50²) ≈ 111.8

Configure these inputs and assert that `closeFourBar({...}, swingarmAngle: 0)` returns the original config (residual ≈ 0, rocker angle ≈ 135°).

```js
// tests/linkage.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeFourBar } from '../src/linkage.js';

test('4-bar closes at static configuration', () => {
  const cfg = {
    Frame_Rocker_Pivot_X: -100, Frame_Rocker_Pivot_Y: 100,
    Rocker_To_Drag_X: -50,      Rocker_To_Drag_Y: 50,
    Drag_To_Swingarm_X: 50,     Drag_To_Swingarm_Y: 0,
  };
  const { rockerAngleDeg, residual } = closeFourBar(cfg, 0);
  assert.ok(Math.abs(residual) < 1e-6);
  assert.ok(Math.abs(rockerAngleDeg - 135) < 0.01, `got ${rockerAngleDeg}`);
});

test('4-bar closure is continuous under small swingarm rotation', () => {
  // Rotate swingarm by 1°; rocker angle should change by a finite amount, not jump
  const cfg = { /* same */ };
  const a = closeFourBar(cfg, 0).rockerAngleDeg;
  const b = closeFourBar(cfg, 1).rockerAngleDeg;
  assert.ok(Math.abs(a - b) < 5, `discontinuity: 0deg=${a}, 1deg=${b}`);
});
```

- [ ] **Step 2: Implement `closeFourBar` via Newton-Raphson on rocker angle**

```js
// src/linkage.js
// Four-bar closure: given swingarm angle β (rotation of swingarm from beta_static),
// find rocker angle φ such that the drag-link length is preserved.
//
// Geometry (origin at swingarm pivot):
//   Frame_Rocker_Pivot = (Px, Py)
//   Drag_To_Swingarm relative to swingarm pivot, rotated by β:
//     Tx_rotated = Tx*cos(β) - Ty*sin(β)
//     Ty_rotated = Tx*sin(β) + Ty*cos(β)
//   Rocker_To_Drag relative to rocker pivot, rotated by Δφ from static:
//     For static rocker offset (Dx0, Dy0):
//       Dx_rotated = Dx0*cos(Δφ) - Dy0*sin(Δφ)
//       Dy_rotated = Dx0*sin(Δφ) + Dy0*cos(Δφ)
//   Drag-link length L = static distance |Dragstatic - Tstatic|.
//   Closure: |(Px + Dxrot) - Trot| = L  → solve for Δφ.

export function closeFourBar(cfg, swingarmDeltaDeg) {
  const β = swingarmDeltaDeg * Math.PI / 180;
  const Px = cfg.Frame_Rocker_Pivot_X, Py = cfg.Frame_Rocker_Pivot_Y;
  const Tx0 = cfg.Drag_To_Swingarm_X, Ty0 = cfg.Drag_To_Swingarm_Y;
  const Dx0 = cfg.Rocker_To_Drag_X - Px, Dy0 = cfg.Rocker_To_Drag_Y - Py;
  // Rotate swingarm-to-drag attachment
  const Tx = Tx0*Math.cos(β) - Ty0*Math.sin(β);
  const Ty = Tx0*Math.sin(β) + Ty0*Math.cos(β);
  // Static drag-link length
  const Lstatic = Math.hypot(Px + Dx0 - Tx0, Py + Dy0 - Ty0);
  // Newton-Raphson on Δφ to make current drag-link length equal Lstatic
  let dphi = 0;
  for (let i = 0; i < 50; i++) {
    const c = Math.cos(dphi), s = Math.sin(dphi);
    const Dx = Dx0*c - Dy0*s, Dy = Dx0*s + Dy0*c;
    const dx = Px + Dx - Tx,  dy = Py + Dy - Ty;
    const L = Math.hypot(dx, dy);
    const residual = L - Lstatic;
    if (Math.abs(residual) < 1e-9) break;
    // dL/d(dphi)
    const dDx_dphi = -Dx0*s - Dy0*c;
    const dDy_dphi =  Dx0*c - Dy0*s;
    const dL_dphi = (dx*dDx_dphi + dy*dDy_dphi) / L;
    dphi -= residual / dL_dphi;
  }
  // Static rocker angle (from frame pivot to Rocker_To_Drag)
  const phiStatic = Math.atan2(Dy0, Dx0) * 180 / Math.PI;
  const rockerAngleDeg = phiStatic + dphi * 180 / Math.PI;
  return {
    rockerAngleDeg,
    residual: Math.hypot(Px + (Dx0*Math.cos(dphi) - Dy0*Math.sin(dphi)) - Tx,
                         Py + (Dx0*Math.sin(dphi) + Dy0*Math.cos(dphi)) - Ty) - Lstatic,
    deltaPhiDeg: dphi * 180 / Math.PI,
  };
}
```

- [ ] **Step 3: Run tests, expect pass**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(linkage): 4-bar closure via Newton-Raphson"
```

## Task C3: Motion Ratio function and Progression

Motion Ratio at the rear wheel = `dy_wheel / dy_shock`. From Task C2 we can compute shock length at any swingarm angle. Then `MR(β) = (rear wheel vertical movement per dβ) / (shock length change per dβ)`.

**Files:**
- Modify: `src/linkage.js`
- Modify: `tests/linkage.test.js`

- [ ] **Step 1: Tests pinning MR + Progression at known config**

Pick a synthetic linkage that gives a known MR (e.g. one with rising-rate behavior). Or, use the placeholder reference-bike geometry once Task C1 has populated it, and pin against the CSV's MotionRatio (within 5% tolerance — see plan tolerance discussion in Phase G).

```js
test('motion ratio at sag matches CSV for R7 (within 5%)', () => {
  const r7 = REFERENCE_BIKES.find(b => b.id === 'r7');
  const inputs = { ...r7.inputs, ...r7.dynamic_presets.sag };
  const out = computeAll(inputs);
  const expected = r7.expected.sag.MotionRatio;
  const tol = expected * 0.05;
  assert.ok(Math.abs(out.Motion_Ratio - expected) < tol,
    `got ${out.Motion_Ratio}, expected ${expected} ± ${tol}`);
});
```

- [ ] **Step 2: Implement `motionRatio(state, swingarmDelta)` and `progression(state)`**

```js
// src/linkage.js
export function rockerShockEnd(cfg, swingarmDeltaDeg) {
  const { rockerAngleDeg, deltaPhiDeg } = closeFourBar(cfg, swingarmDeltaDeg);
  const Px = cfg.Frame_Rocker_Pivot_X, Py = cfg.Frame_Rocker_Pivot_Y;
  const Sx0 = cfg.Rocker_To_Shock_X - Px, Sy0 = cfg.Rocker_To_Shock_Y - Py;
  const c = Math.cos(deltaPhiDeg * Math.PI / 180);
  const s = Math.sin(deltaPhiDeg * Math.PI / 180);
  return { x: Px + Sx0*c - Sy0*s, y: Py + Sx0*s + Sy0*c };
}

export function shockLength(cfg, swingarmDeltaDeg) {
  const e = rockerShockEnd(cfg, swingarmDeltaDeg);
  return Math.hypot(e.x - cfg.Frame_Shock_Top_X, e.y - cfg.Frame_Shock_Top_Y);
}

export function rearWheelHeight(cfg, swingarmDeltaDeg, swingarmLength) {
  // Rear-wheel y-position relative to swingarm pivot, given current swingarm rotation
  // (β_static + delta).
  const total = (cfg.beta_static + swingarmDeltaDeg) * Math.PI / 180;
  return swingarmLength * Math.sin(total);
}

export function motionRatio(cfg, swingarmDeltaDeg, swingarmLength) {
  const ε = 0.5; // degrees — finite-difference step
  const yPlus  = rearWheelHeight(cfg, swingarmDeltaDeg + ε, swingarmLength);
  const yMinus = rearWheelHeight(cfg, swingarmDeltaDeg - ε, swingarmLength);
  const sPlus  = shockLength(cfg, swingarmDeltaDeg + ε);
  const sMinus = shockLength(cfg, swingarmDeltaDeg - ε);
  return Math.abs((yPlus - yMinus) / (sPlus - sMinus));
}
```

For Progression: `(MR_at_full_bump - MR_at_topout) / MR_at_topout × 100`.

- [ ] **Step 3: Wire into formulas.js**

Update `CALC.Motion_Ratio` and `CALC.Progression` to call into linkage functions. Remove from `KNOWN_STUB_NAN`.

- [ ] **Step 4: Run tests, expect pass for whichever bikes Task C1 sourced real coords for**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(linkage): motion ratio and progression from 4-bar geometry"
```

## Task C4: Rear Wheel Vertical Travel + Rear Ride Height

`Rear_Wheel_Vertical_Travel` = `swingarmLength × (sin(β_static + Δβ) − sin(β_static))` for the current Δβ derived from the shock-length change driven by `Travel_Rear` (rear shock potentiometer reading).

`Rear_Ride_Height` is a reference height defined as the vertical distance from a fixed chassis point to the rear axle, signed negative when the swingarm is below horizontal. CSV uses chassis-floor reference.

**Files:**
- Modify: `src/linkage.js` (add `rearVerticalTravel`, `rearRideHeight`)
- Modify: `src/formulas.js` (wire CALCs, remove stubs)
- Modify: `tests/linkage.test.js`

- [ ] **Step 1: Write tests pinning each output for R7 sag/braking/mid_corner against CSV**

```js
for (const preset of ['sag', 'braking', 'mid_corner']) {
  test(`R7 ${preset}: rear_vertical_travel within 5%`, () => {
    const r7 = REFERENCE_BIKES.find(b => b.id === 'r7');
    const inputs = { ...r7.inputs, ...r7.dynamic_presets[preset] };
    const out = computeAll(inputs);
    const exp = r7.expected[preset].Rear_Travel;
    const tol = Math.max(1, Math.abs(exp) * 0.05);
    assert.ok(Math.abs(out.Rear_Wheel_Vertical_Travel - exp) < tol);
  });
  test(`R7 ${preset}: rear_ride_height within 5 mm`, () => {
    const r7 = REFERENCE_BIKES.find(b => b.id === 'r7');
    const inputs = { ...r7.inputs, ...r7.dynamic_presets[preset] };
    const out = computeAll(inputs);
    const exp = r7.expected[preset].Rear_RHR;
    assert.ok(Math.abs(out.Rear_Ride_Height - exp) < 5);
  });
}
```

- [ ] **Step 2: Implement and wire**

```js
// src/linkage.js
export function rearVerticalTravel(cfg, swingarmDeltaDeg, L) {
  const total = (cfg.beta_static + swingarmDeltaDeg) * Math.PI / 180;
  const static_ = cfg.beta_static * Math.PI / 180;
  return L * (Math.sin(total) - Math.sin(static_));
}

export function rearRideHeight(cfg, swingarmDeltaDeg, L, refY) {
  // refY is a fixed chassis reference height; CSV uses chassis floor.
  // For Phase A simplicity, take refY = 0 and report rear-axle Y.
  const total = (cfg.beta_static + swingarmDeltaDeg) * Math.PI / 180;
  return refY - L * Math.sin(total);
}
```

For the swingarm delta induced by a given `Travel_Rear` (input), invert: solve for Δβ such that `shockLength(cfg, Δβ) = shockLength(cfg, 0) - shockChangeFromTravelRear`. This needs a single-variable search.

- [ ] **Step 3: Run tests; if tolerance bands fail, document discrepancy**

If we cannot match within 5% with sourced linkage coords, that's a real signal — either coords are wrong, MotoSpec uses a slightly different convention, or our formula is wrong. Investigate before tightening tolerances or fudging.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(linkage): rear travel and ride height from shock state"
```

## Task C5: Update DATA TABLE — show all Phase C results

The renderer in `src/data-table.js` already routes computed ids through `computeAll`. Now that Motion_Ratio, Progression, Rear_Ride_Height, Rear_Wheel_Vertical_Travel are real, they'll show up automatically. Verify in browser that the four new rows display sensible numbers in the Current column.

- [ ] **Step 1: Add a regression test asserting these rows are no longer em-dash for default state**

```js
// tests/data-table.test.js
test('Phase C rows render numerics for default state', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const [label, _] of [
    ['Motion Ratio'],
    ['Progression'],
    ['Rear Ride Height'],
    ['Rear Wheel Vertical Travel'],
  ]) {
    const row = html.match(new RegExp(`<tr>[\\s\\S]*?${label}[\\s\\S]*?</tr>`))[0];
    // Current column is the last <td>
    const lastTd = row.match(/<td[^>]*>([^<]+)<\/td>/g).pop();
    assert.notMatch(lastTd, /—/, `${label} still em-dash`);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git commit -am "test: assert Phase C rows render real values in DATA TABLE"
```

---

# Phase D — Spring system

Goal: implement Rear_Wheel_Rate from spring rate × motion-ratio², handle Front_Wheel_Rate as an explicit research deliverable (no fudged formula).

## Task D1: Front Wheel Rate research

Per design decision #2, Front_Wheel_Rate is **not** implemented blindly. Investigate the formula MotoSpec uses by:

1. Trying combinations like `2 × spring × cos²(rake)`, `2 × spring × cos²(rake) × (something with trail)`, `2 × spring × (some function of rake/wheelbase)`.
2. Comparing against the three reference data points (R7=33.74, GSX=28.96, Aprilia=31.85; springs 9.0, 8.5, 9.5 N/mm respectively, single-leg rate).
3. Reading public motorcycle suspension references (Cossalter "Motorcycle Dynamics" §8, Foale "Motorcycle Handling and Chassis Design" Ch.7) for the wheel-rate formula under raked-fork geometry.

**Files:**
- Create: `docs/research/front-wheel-rate.md`

- [ ] **Step 1: Document attempts and findings**

The note must contain:
- Each formula tried, the three predictions, and the residuals against CSV.
- Whether any closed-form formula reproduces all three CSV values within 5%.
- A literature reference for whatever formula is adopted, or a clear statement that no closed-form reproduces the CSV and the FWR row will remain `—` until source can be traced.

- [ ] **Step 2: Commit research note**

```bash
git commit -am "research: document front wheel rate formula investigation"
```

## Task D2: Implement Front_Wheel_Rate (gated by D1's findings)

If D1 finds a formula that matches:

- [ ] Add to `src/springs.js` (`frontWheelRate(state)`)
- [ ] Tests pinning each reference bike within 5%
- [ ] Wire `CALC.Front_Wheel_Rate`; remove from `KNOWN_STUB_NAN`
- [ ] Commit

If D1 does NOT find a formula:

- [ ] Leave `CALC.Front_Wheel_Rate = () => NaN` and the DATA TABLE row showing `—`.
- [ ] Document the gap in `docs/research/front-wheel-rate.md` (must persist to PRD Phase 2 — when MotoSpec is purchased, derive the formula by feeding controlled inputs to MotoSpec).
- [ ] Commit a no-op commit with message stating the row is intentionally em-dash pending Phase 2 cross-reference.

## Task D3: Rear_Wheel_Rate via motion ratio

`Rear_Wheel_Rate = Rear_Spring_Rate / Motion_Ratio²`

**Files:**
- Create: `src/springs.js`
- Create: `tests/springs.test.js`
- Modify: `src/formulas.js`

- [ ] **Step 1: Write failing test**

```js
test('Rear_Wheel_Rate matches CSV for R7 sag (within 8%)', () => {
  const r7 = REFERENCE_BIKES.find(b => b.id === 'r7');
  const inputs = { ...r7.inputs, ...r7.dynamic_presets.sag };
  const out = computeAll(inputs);
  const exp = r7.expected.sag.RWR;  // 18.97
  assert.ok(Math.abs(out.Rear_Wheel_Rate - exp) < exp * 0.08);
});
```

(Wider tolerance because both rear spring rate and MR have measurement variance; CSV's 18.97 vs naïve `110/2.488²=17.78` is an 8% miss using sag MR alone — MotoSpec likely uses a load-corrected MR.)

- [ ] **Step 2: Implement, wire, run tests**

```js
// src/springs.js
export function rearWheelRate(state, motionRatio) {
  return state.Rear_Spring_Rate / (motionRatio * motionRatio);
}
```

`CALC.Rear_Wheel_Rate = v => rearWheelRate(v, v.Motion_Ratio)`. Remove from KNOWN_STUB_NAN.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: rear wheel rate from spring rate and motion ratio"
```

---

# Phase E — Dynamic wheelbase under load

Goal: replace the static `WB` input with a computed wheelbase that accounts for fork compression (wheel moves rearward as forks compress and rake closes) and rear shock travel (rear axle moves forward as swingarm rotates down).

## Task E1: Dynamic wheelbase formula

Wheelbase change under fork compression:
- Fork tube + clamp slides; the front contact patch moves rearward by approximately `Travel_Front × sin(Rake_Static)`.
- Wheel center moves rearward by `Travel_Front × sin(Rake_Static)`; rolls slightly forward by tire deformation but ignore at this level.

Wheelbase change under rear travel:
- Rear axle moves forward (toward bike center) by `swingarmLength × (cos(β_static) − cos(β_static + Δβ))`.

Total wheelbase = `WB_static − Δfront − Δrear` (or similar; signs depend on convention).

**Files:**
- Modify: `src/formulas.js` (rename existing `WB` from input to `WB_Static` and create computed `Wheelbase`)
- Modify: `src/data-table.js` (point ROW to `Wheelbase` not `WB`)
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Test pinning WB against CSV for each preset**

```js
test('R7 wheelbase tracks CSV across presets (within 1%)', () => {
  const r7 = REFERENCE_BIKES.find(b => b.id === 'r7');
  for (const preset of ['sag', 'braking', 'mid_corner']) {
    const inputs = { ...r7.inputs, ...r7.dynamic_presets[preset] };
    const out = computeAll(inputs);
    const exp = r7.expected[preset].Wheelbase;
    assert.ok(Math.abs(out.Wheelbase - exp) < exp * 0.01);
  }
});
```

- [ ] **Step 2: Implement Wheelbase calc**

```js
// inside src/formulas.js or a new src/wheelbase.js
Wheelbase: v => {
  const dfront = v.Travel_Front * Math.sin(v.Rake_Static * D2R);
  const dbeta_static_rad = v.beta_static * D2R;
  const dbeta = (v.MotoSPEC_SwgarmAngl - v.beta_static) * D2R; // negative on bump
  const drear = v.Swingarm_Length * (Math.cos(dbeta_static_rad) - Math.cos(dbeta_static_rad + dbeta));
  return v.WB_Static - dfront - drear;
}
```

(Signs to verify against CSV during test runs.)

- [ ] **Step 3: Migrate every existing reference to `WB` to `WB_Static` or `Wheelbase` as appropriate**

`MotoSPEC_FrontForce` / `MotoSPEC_RearForce` use WB to compute `delta_W`. Decide: use static or dynamic? CSV's COG % numbers (44.6/55.4 at sag, 53.6/46.4 at braking) suggest MotoSpec uses **dynamic** WB inside ΔW because that's how the actual front/rear forces shift. Confirm by trying both and seeing which pins the CSV's FWF/RWF.

- [ ] **Step 4: Run tests, fix sign/convention until they pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: dynamic wheelbase under fork comp and rear shock travel"
```

## Task E2: COG_Front / COG_Rear from CG geometry

CSV reports `CofG % Front` per preset (e.g., R7 sag 44.6%, braking 53.6%). Currently we expose `front_weight_dist` as input. To match the CSV, derive COG_Front = (out.MotoSPEC_FrontForce / (out.MotoSPEC_FrontForce + out.MotoSPEC_RearForce)) × 100.

**Files:**
- Modify: `src/formulas.js`

- [ ] **Step 1: Add CALC**

```js
COG_Front_Pct: v => 100 * v.MotoSPEC_FrontForce / (v.MotoSPEC_FrontForce + v.MotoSPEC_RearForce),
COG_Rear_Pct:  v => 100 - v.COG_Front_Pct,
```

- [ ] **Step 2: Tests against CSV (within 1%)**

- [ ] **Step 3: Wire into DATA TABLE rows for `CofG % Front/Rear`**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: COG % rows derived from front/rear forces"
```

---

# Phase F — Lean-angle effects (deferred per design decision #3)

Goal at end of Phase F: when `Lean_Angle ≠ 0`, `MotoSPEC_Trail` and `Wheelbase` correct for the tilted-bike geometry (the steering axis is no longer in the bike's symmetry plane; the contact patch shifts with lean).

This phase is independently shippable. Skip if the user wants Phase G validation against zero-lean rows only.

## Task F1: Trail-under-lean math

When the bike leans by angle θ, the steering axis rotates by θ in the lean plane. The effective rake (angle vs vertical) becomes `rake_effective = arctan(tan(rake_static) × cos(θ))` — a known result from Cossalter §3.

- [ ] Test pinning R7 mid_corner Trail (lean 55°) against CSV value (76.7 mm) within 1 mm
- [ ] Implement `trailUnderLean(rake, lean)` in `src/lean.js`
- [ ] Wire into `MotoSPEC_Trail` calc — guard on `Lean_Angle === 0` to keep static path identical
- [ ] Commit

## Task F2: Wheelbase-under-lean

Similar: lean foreshortens the projected wheelbase by `cos(lean)` to first order. Verify against CSV mid_corner (R7: 1360.7 mm).

- [ ] Test
- [ ] Implement
- [ ] Wire
- [ ] Commit

## Task F3: Update DATA TABLE — column per dynamic preset

Phase A's table shows one preset per bike (sag). For lean validation we want to compare all three presets per bike. Switch from "3 bikes × 1 preset" to "3 bikes × 3 presets = 9 columns" (or use a preset selector UI).

- [ ] Decide: 9-col table vs preset dropdown. Prototype, choose, commit.

---

# Phase G — Cross-validation harness

Goal: a single test file that asserts every result row of every reference bike × every preset matches the CSV within documented tolerance.

## Task G1: Full-parity test

**Files:**
- Create: `tests/full-parity.test.js`

- [ ] **Step 1: Define tolerances**

```js
const TOL = {
  Rake:        0.02,     // degrees
  Trail:       1,        // mm
  Rear_Travel: 1,        // mm
  Rear_RHR:    1,        // mm
  Swingarm_Angle: 0.05,  // degrees
  AntiSquat:   1,        // %
  Progression: 1,        // %
  MotionRatio: 0.05,     // ratio units
  Wheelbase:   1,        // mm
  FWR:         1,        // N/mm  (or skip if Phase D Task 2 didn't ship)
  RWR:         1.5,      // N/mm
  FWF:         20,       // N
  RWF:         20,       // N
  COG_Front:   0.5,      // %
  COG_Rear:    0.5,      // %
};
```

- [ ] **Step 2: Loop test**

```js
for (const bike of REFERENCE_BIKES) {
  for (const presetName of ['sag', 'braking', 'mid_corner']) {
    const inputs = { ...bike.inputs, ...bike.dynamic_presets[presetName] };
    const out = computeAll(inputs);
    const exp = bike.expected[presetName];
    test(`${bike.id} ${presetName}: full parity`, () => {
      const fails = [];
      for (const [csvKey, calcKey] of CSV_TO_CALC_KEYS) {
        if (exp[csvKey] == null) continue;
        const got = out[calcKey];
        if (!Number.isFinite(got)) continue;  // explicit stub — Phase D
        const tol = TOL[csvKey];
        if (Math.abs(got - exp[csvKey]) > tol) {
          fails.push(`${csvKey}: got ${got.toFixed(2)}, expected ${exp[csvKey]} ± ${tol}`);
        }
      }
      assert.equal(fails.length, 0, fails.join('\n'));
    });
  }
}
```

- [ ] **Step 3: Run; document any rows that don't meet tolerance**

A failing row at this stage is real signal — either a formula bug or an input mismatch. Investigate.

- [ ] **Step 4: Commit**

## Task G2: README of validation status

**Files:**
- Create: `docs/validation-status.md`

- [ ] Document, per result row, whether it matches CSV within tolerance for each (bike, preset). Marks: ✅ within tol, ⚠️ outside tol but plausible, ❌ stub.
- [ ] Commit

---

## Self-Review

**Spec coverage** (CSV row → task):

| CSV row | Task |
|---|---|
| FRONT/REAR/TIRE/SPROCKET inputs | A1 + A2 |
| DYNAMIC READINGS inputs | A1 + A2 (`Travel_Front`, `Travel_Rear`, `Lean_Angle`) |
| Rake | already (existing `MotoSPEC_Rake`) |
| Ground Trail | already (existing `MotoSPEC_Trail`) |
| Rear Wheel Vertical Travel | C4 |
| Rear Ride Height Reference | C4 |
| Swingarm Angle | already (existing `MotoSPEC_SwgarmAngl`) |
| AntiSquat | already (existing `MotoSPEC_AntSquat`) |
| Progression | C3 |
| Motion Ratio | C3 |
| Wheelbase (dynamic) | E1 |
| Front Wheel Rate | D1 + D2 (gated by research) |
| Rear Wheel Rate | D3 |
| Front/Rear Wheel Force | already (existing `MotoSPEC_FrontForce/RearForce`) — but Phase E1 may need to re-check that they use dynamic WB |
| CofG % Front/Rear | E2 |
| Trail under lean / WB under lean | F1 + F2 |

**Placeholder scan:** "real linkage coords" placeholder values in Task A1 are explicitly addressed by Task C1 (research task). All other steps include code or specific commands.

**Type consistency:** `Motion_Ratio`, `Progression`, `Rear_Ride_Height`, `Rear_Wheel_Vertical_Travel`, `Rear_Wheel_Rate`, `Front_Wheel_Rate`, `Wheelbase`, `WB_Static`, `COG_Front_Pct`, `COG_Rear_Pct` are used identically across `formulas.js`, `data-table.js`, tests, and the row map in `ROW_GROUPS`. The bike id keys (`r7`, `gsx8r`, `rs660`) are consistent in `REFERENCE_BIKES`, fixtures, and tests.

**Phase shippability:** at the end of Phase A, the page works and is honest. At the end of every subsequent phase, more rows are real — none regress. Phase F is fully optional / deferable. Phase G is the final polish.

**Known risks called out:**
1. Linkage coords from manufacturer literature may not exist for one or more bikes — mitigation in Task C1.
2. Front Wheel Rate formula may not be reverse-engineerable from CSV alone — mitigation: explicit research task (D1) with three branches, including "leave as `—`".
3. MotoSpec's `Wheelbase` and `MotionRatio` columns may use dynamic-load corrections we can't infer — mitigation: 5%/1mm tolerance bands in Phase G, document deviations, plan for Phase 2 cross-validation against MotoSpec itself.

---

# Phase H — Result-accuracy & input-coverage gaps (added 2026-05-06)

While auditing the RESULTS column we found the page renders values for several rows whose formulas are not actually wired to the data-table inputs. Status badges were added to make this visible to users (`PARTIAL`, `APPROX`, in addition to existing `PENDING` / `NEEDS COORDS` / `STATIC`); the formulas themselves still need real fixes. Tracking each as a discrete task here.

### Already done (2026-05-06)
- **`O` is now derived**: `O = Yoke_Offset` (channel, not input). Changing the clamp / Yoke Offset in the data table updates Ground Trail. Rake correctly stays unaffected (rake is set by the steering-head angle, not yoke offset). `Wheel_Hub_Offset` was tried as a second contributor but removed because it's effectively always 0 — re-add only if a non-zero hub offset case appears.
- **Status badges expanded** in `src/data-table.js` STATUS_BADGE: added `partial` (orange) and `approx` (purple) with bilingual tooltips. Tagged rows accordingly.
- **Linkage Setup → "Save as preset"**: the Linkage Setup page can save the current 12 linkage spec fields (mode + 5 XY pairs + Linkarm_Length) as a user-overlay entry in `CATALOGS.linkages` via `setCatalogEntry`, slugifying the user-entered name and deduping on collision. Helpers exported from `src/linkage-setup.js` (`slugifyLinkageName`, `buildLinkagePresetEntry`, `LINKAGE_SPEC_FIELDS`) so they're testable.
- **H1 done (2026-05-06)**: `MotoSPEC_SwgarmAngl` now routes through the 4-bar linkage closure (`swingarmDeltaForShockTravel`) instead of the `asin(Travel_Rear / L_SA)` shortcut. Badge changed `APPROX` → `NEEDS COORDS` because the formula is real but reference bikes still ship placeholder linkage coords.

### Task H1: Swingarm Angle through linkage (currently `APPROX`) — DONE 2026-05-06
**Done.** `MotoSPEC_SwgarmAngl` calc now builds a `cfg` from the 5 linkage XY pairs + `Linkage_Mode` + `beta_static` and adds `swingarmDeltaForShockTravel(cfg, Travel_Rear)` (signed degrees) to `beta_static`. Sign convention: on bump the wheel rises and Δβ is negative, so the displayed angle drops below `beta_static`. The `delta_beta` intermediate is kept (no other consumer, no harm). Badge moved `APPROX` → `NEEDS COORDS` in `src/data-table.js`. New test: `MotoSPEC_SwgarmAngl is routed through the linkage (H1)` in `tests/formulas.test.js`.
`MotoSPEC_SwgarmAngl` uses `β_static − asin(Travel_Rear / L_SA)·R2D`, which:
- treats `Travel_Rear` (the rear potentiometer / shock-pot reading) as if it were rear-wheel vertical travel;
- bypasses the 4-bar linkage entirely.

The same `Travel_Rear` input is consumed differently by `Rear_Wheel_Vertical_Travel` (treats it as shock displacement → linkage closure → wheel travel). The two answers disagree.

**Fix:** replace with the linkage-consistent path: `Δβ = swingarmDeltaForShockTravel(cfg, Travel_Rear)`; `MotoSPEC_SwgarmAngl = β_static + Δβ` (sign convention check). Once Phase C real coords are in, pin against reference-bike `expected.Swingarm_Angle`.

### Task H2: AntiSquat with dynamic chain angle (currently `APPROX`) — DONE 2026-05-06
**Done.** New intermediate `theta_chain_dynamic` (degrees) computes the upper external tangent between front and rear sprockets:
- Sprocket pitch radii from tooth counts + `Chain_Pitch` (default 15.875 mm; covers 520/525/530).
- Front sprocket center frame-fixed at `(Front_Sprocket_X, Front_Sprocket_Y)` (placeholders `(50, 10)` mm — refine per bike).
- Rear sprocket center on swingarm at `(−Swingarm_Length·cosβ, −Swingarm_Length·sinβ)` where β = `MotoSPEC_SwgarmAngl`.
- `theta = atan2(Cf.y − Cr.y, Cf.x − Cr.x) + asin((r_f − r_r) / d)` (rad → deg). Sign convention: positive when chain top tilts upward going from rear toward front.

`theta_thrust` and therefore `MotoSPEC_AntSquat` now route through `theta_chain_dynamic`. The static `theta_chain` input was **removed** from `P`, `INPUT_META`, `defaultValues()`, `index.html` UI label, and `COMMON_ENV` in `reference-bikes.js`. The diagram in `index.html` was renamed to key off `theta_chain_dynamic`. Data-table badge moved `APPROX` → `NEEDS COORDS` because the formula is real but accuracy depends on placeholder linkage + sprocket coords.

New tests in `tests/formulas.test.js`: sanity check (rear-bigger-and-level → negative chain tilt), default-state finiteness/range, and AntiSquat-changes-when-front-sprocket-X-moved (proves the new path is wired). `theta_chain` removal asserted.

Original brief follows for context:
`MotoSPEC_AntSquat` chains off the approximate swingarm angle (H1) and uses `theta_chain` as a static input. Real anti-squat needs:
- correct dynamic swingarm angle (requires H1);
- chain pull line recomputed from front-sprocket center, rear-sprocket center (which moves with the swingarm), and sprocket radii (derived from `Front_Sprocket` / `Rear_Sprocket` tooth counts + chain pitch).

**Fix:** add a `theta_chain_dynamic` channel deriving the line from sprocket geometry; route AntiSquat through it. Drop or hide the static `theta_chain` input.

### Task H3: Expose dynamic-load inputs in the data table (currently `PARTIAL`)
`MotoSPEC_FrontForce` / `MotoSPEC_RearForce` formulas are correct, but the inputs `a_x`, `V`, `Cd`, `A`, `C_f_aero`, `C_r_aero`, `front_weight_dist`, `rear_weight_dist` are not exposed in the data table — every bike uses `defaultValues()` for them, so the displayed forces are essentially fixed-default placeholders that don't reflect the bike's actual condition.

**Fix options (pick one):**
1. Add a "DYNAMIC LOAD" group below DYNAMIC READINGS: editable `a_x`, `V`, `Cd`, `A`, `Lean_Angle`. Weight-distribution stays per-bike (not per-preset).
2. Bake them into preset definitions in `PRESET_VALUES` (e.g. `braking: { a_x: 1.2, V: 30, ... }`) so a preset selection drives the load case. Lighter UI footprint but less explicit.

Pin with reference-bike `expected.Front_Wheel_Force` / `Rear_Wheel_Force` after wiring.

### Task H4: Dynamic Wheelbase (currently `STATIC`)
`Wheelbase (mm)` row currently echoes the `WB` input verbatim. This is what Phase E1 was already scoped to fix (`WB_dynamic = WB_static + Δfront − Δrear` from fork compression and rear linkage). Mark the row's `STATIC` badge as a stand-in until E1 lands; remove the badge in E1.

### Task H5: CofG % rows are echoes (currently `STATIC`)
`CofG % Front` / `CofG % Rear` are `front_weight_dist × 100`. Real dynamic CG-to-axle distribution under acceleration/braking is `(W_F_Static + ΔW) / (W_F + W_R)` — which we already compute internally for the force rows. Phase E2 already covers this; keep the badge until E2 lands.

### Task H6: `Lean_Angle` input is unused
The data-table preset `mid_corner` sets `Lean_Angle: 55`, the input is registered (`P.Lean_Angle`, `INPUT_META.Lean_Angle`), but **no CALC reads it**. It is a no-op. Either:
- wire it to Phase F (Trail-under-lean / Wheelbase-under-lean) immediately and lift Phase F's "deferred" status, or
- mark the input row as `PENDING` until Phase F runs to avoid the misleading impression that lean affects the displayed results.

### Task H7: Hidden bike-intrinsic geometry not editable
`Rake_Static`, `beta_static`, `L_SA`, `theta_chain`, `H_CG`, `L_CG`, `Mass`, `front_weight_dist`, `rear_weight_dist` are bike-intrinsic and live only in `reference-bikes.js` `geometry`/`environment` blocks. The data table neither shows nor edits them, but they drive Rake, Trail, force, swingarm-angle, anti-squat, etc.

**Fix:** add a collapsed "FRAME GEOMETRY" group above FRONT SETTINGS that surfaces these inputs as editable cells (defaulted from the bike's reference data, but overridable per column). This is the simplest way for a user to model "what if I steepen the rake" or "what if my pillion adds 30 kg".

---

## Status badge legend (current state)

| Badge | Meaning |
|---|---|
| (none) | Real formula, all relevant inputs editable in table |
| `STATIC` (gray) | Echoes a static input — does not respond to dynamic compression/load |
| `NEEDS COORDS` (yellow) | Formula is real; defaults to placeholder linkage coordinates |
| `PARTIAL` (orange) | Formula real, but some inputs use hidden defaults the user can't change here |
| `APPROX` (purple) | Simplified geometry that bypasses the full linkage / driveline model |
| `PENDING` (red) | Not implemented — returns `NaN` |

When a phase task lands and removes a gap, the badge should be removed in the same commit.

---

## Coverage table — current vs. plan-target

| Row | Current badge | Resolved by |
|---|---|---|
| Rake | — | ✓ done |
| Ground Trail | — | ✓ done (Yoke_Offset wired) |
| Rear Wheel Vertical Travel | NEEDS COORDS | C1 (real coords) |
| Rear Ride Height Reference | NEEDS COORDS | C1 |
| Swingarm Angle | NEEDS COORDS | **H1** done — coords still placeholder (resolved by C1) |
| AntiSquat | APPROX | **H2** (new) |
| Progression | NEEDS COORDS | C1 |
| Motion Ratio | NEEDS COORDS | C1 |
| Wheelbase | STATIC | E1 (existing) — see H4 |
| Front Wheel Rate | PENDING | D1 + D2 |
| Rear Wheel Rate | PENDING | D3 |
| Front Wheel Force | PARTIAL | **H3** (new) |
| Rear Wheel Force | PARTIAL | **H3** |
| CofG % Front | STATIC | E2 (existing) — see H5 |
| CofG % Rear | STATIC | E2 — see H5 |
| Lean_Angle input | (no-op) | **H6** (new) or Phase F |
| Frame geometry inputs | hidden | **H7** (new) |
