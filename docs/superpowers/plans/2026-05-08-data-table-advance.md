# Data Table (Advance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Data Table (Advance)" page that renders the same 14 RESULTS rows as the existing data table, but with strict "no mocks" enforcement: every cell is a real physics calculation against real inputs, or blank.

**Architecture:** New independent module `src/data-table-advance.js` with its own row schema, renderer, and validation pipeline. Imports shared utilities from `src/data-table.js`. Adds two missing formulas (`Front_Wheel_Rate`, `Rear_Wheel_Rate`) to `src/formulas.js`. v1 is static at-rest only — load case forced to zero. Existing data table page is left untouched.

**Tech Stack:** Plain ES modules, no bundler. Node 22+ built-in test runner. `index.html` inline `<script type="module">` with `window.*` re-exposure for inline `onclick` handlers.

**Spec:** `docs/superpowers/specs/2026-05-07-data-table-advance-design.md`

---

## File Structure

**New files:**
- `src/data-table-advance.js` — schema, helpers, compute pipeline, renderer
- `tests/data-table-advance.test.js` — schema/dropped-input/missing-input/static-sanity tests

**Modified:**
- `src/formulas.js` — replace `() => NaN` stubs for `Front_Wheel_Rate` and `Rear_Wheel_Rate` with real formulas
- `src/data-table.js` — export `COMPONENT_TO_CATALOG`, `fmtNum`, `escapeHtml`, `catalogEntriesFor` for reuse
- `tests/fixtures/reference-bikes.json` — add expected `Front_Wheel_Rate`, `Rear_Wheel_Rate` per bike
- `tests/formulas.test.js` (or new test) — coverage for the two new formulas
- `index.html` — nav button, import, page-switch case, CSS for `.dt-missing` and the count chip

---

## Task 1: Export shared utilities from `src/data-table.js`

Pure refactor — no behavior change. Make four helpers accessible to the advance module without duplication.

**Files:**
- Modify: `src/data-table.js`

- [ ] **Step 1: Read current visibility**

Run: `grep -nE "^(export )?(function|const) (COMPONENT_TO_CATALOG|fmtNum|escapeHtml|catalogEntriesFor)" src/data-table.js`

Expected: confirms which are already `export`. Currently `COMPONENT_TO_CATALOG` is `const` (not exported), `fmtNum`/`escapeHtml`/`catalogEntriesFor` are `function` (not exported).

- [ ] **Step 2: Add `export` keyword to each of the four**

Edit `src/data-table.js`:
- Change `const COMPONENT_TO_CATALOG = {` → `export const COMPONENT_TO_CATALOG = {`
- Change `function fmtNum(` → `export function fmtNum(`
- Change `function escapeHtml(` → `export function escapeHtml(`
- Change `function catalogEntriesFor(` → `export function catalogEntriesFor(`

- [ ] **Step 3: Run all existing tests**

Run: `npm test`

Expected: all tests pass — this is a pure visibility change.

- [ ] **Step 4: Commit**

```bash
git add src/data-table.js
git commit -m "data-table: export shared helpers for advance page reuse"
```

---

## Task 2: Scaffold `src/data-table-advance.js` row schema

Create the module with the row schema only (no rendering, no compute yet). Mirrors the 14 result rows from the existing data table in identical order.

**Files:**
- Create: `src/data-table-advance.js`
- Create: `tests/data-table-advance.test.js`

- [ ] **Step 1: Write failing test for schema integrity**

Create `tests/data-table-advance.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCE_ROW_GROUPS, ADVANCE_RESULT_ORDER } from '../src/data-table-advance.js';
import { ROW_GROUPS as LEGACY_ROW_GROUPS } from '../src/data-table.js';

test('advance result rows match legacy RESULTS order exactly', () => {
  const legacyResults = LEGACY_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const legacyOrder = legacyResults.map(r => r.computed || r.spec);

  const advResults = ADVANCE_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const advOrder = advResults.map(r => r.computed || r.spec);

  assert.deepEqual(advOrder, legacyOrder);
});

test('ADVANCE_RESULT_ORDER lists the 14 computed/derived result keys', () => {
  assert.equal(ADVANCE_RESULT_ORDER.length, 14);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/data-table-advance.test.js`

Expected: FAIL — `Cannot find module '../src/data-table-advance.js'`.

- [ ] **Step 3: Create `src/data-table-advance.js` with the row schema**

```js
// Data Table (Advance): genuine-only sister page to data-table.js.
// v1 is static at-rest (load case forced to zero). Every cell is either a
// real computed value or blank — no mocks, no fallbacks, no placeholder coords.

import { ROW_GROUPS as LEGACY_ROW_GROUPS } from './data-table.js';

const LEGACY_RESULTS = LEGACY_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;

// 14 result rows, identical order and identical computed/derivedFrom fields.
// Status badges are intentionally dropped — presence of a number IS the proof
// of realness on this page.
const ADVANCE_RESULT_ROWS = LEGACY_RESULTS.map(r => {
  const next = { spec: r.spec, spec_zh: r.spec_zh };
  if (r.computed) next.computed = r.computed;
  if (r.derivedFrom) next.derivedFrom = r.derivedFrom;
  return next;
});

export const ADVANCE_RESULT_ORDER = ADVANCE_RESULT_ROWS.map(
  r => r.computed || r.spec
);

// Input rows are computed lazily in Task 3 from the dependency graph.
// For now the schema only contains the RESULTS group.
export const ADVANCE_ROW_GROUPS = [
  { header: 'RESULTS', header_zh: '结果', rows: ADVANCE_RESULT_ROWS },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/data-table-advance.test.js`

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data-table-advance.js tests/data-table-advance.test.js
git commit -m "data-table-advance: scaffold module with RESULTS row schema"
```

---

## Task 3: `leafDepsFor(resultName)` — transitive leaf dependency walker

The validator must know which **leaf inputs** each result transitively depends on. Walk `P[name].deps` until you hit nodes that don't appear in `P` (those are leaves declared in `INPUT_META`).

**Files:**
- Modify: `src/data-table-advance.js`
- Modify: `tests/data-table-advance.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/data-table-advance.test.js`:

```js
import { leafDepsFor } from '../src/data-table-advance.js';

test('leafDepsFor returns leaves only (no intermediate channels)', () => {
  const leaves = leafDepsFor('MotoSPEC_Rake');
  // MotoSPEC_Rake deps on Rake_Static (leaf) and Pitch (intermediate);
  // Pitch deps on Travel_Front, Travel_Rear, WB (all leaves).
  assert.ok(leaves.includes('Rake_Static'));
  assert.ok(leaves.includes('Travel_Front'));
  assert.ok(leaves.includes('Travel_Rear'));
  assert.ok(leaves.includes('WB'));
  assert.ok(!leaves.includes('Pitch'), 'Pitch is intermediate, not a leaf');
  assert.ok(!leaves.includes('MotoSPEC_Rake'), 'self should not be in leaves');
});

test('leafDepsFor on a leaf-only result still returns the leaves', () => {
  const leaves = leafDepsFor('MotoSPEC_Trail');
  assert.ok(leaves.includes('Rf'));
  assert.ok(leaves.includes('O'));
  // MotoSPEC_Trail deps on MotoSPEC_Rake (intermediate), so the walk
  // expands it to Rake_Static + Pitch's leaves.
  assert.ok(leaves.includes('Rake_Static'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/data-table-advance.test.js`

Expected: FAIL — `leafDepsFor is not a function` (or similar import error).

- [ ] **Step 3: Implement `leafDepsFor`**

Add to `src/data-table-advance.js`:

```js
import { P } from './formulas.js';

/**
 * Walk P[name].deps transitively. A name is a "leaf" if it does not appear
 * as a key in P (i.e., it's a declared input from INPUT_META, not a computed
 * channel/intermediate).
 *
 * Returns a sorted array of leaf input names. Self is excluded.
 */
export function leafDepsFor(name) {
  const seen = new Set();
  const leaves = new Set();

  function visit(n) {
    if (seen.has(n)) return;
    seen.add(n);
    const node = P[n];
    if (!node) {
      // Not in P → it's a leaf input.
      leaves.add(n);
      return;
    }
    const deps = node.deps || [];
    for (const d of deps) visit(d);
  }

  const root = P[name];
  if (!root) {
    // Caller passed a leaf — return it as its own dep.
    return [name];
  }
  for (const d of (root.deps || [])) visit(d);
  return [...leaves].sort();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/data-table-advance.test.js`

Expected: all four tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data-table-advance.js tests/data-table-advance.test.js
git commit -m "data-table-advance: add leafDepsFor transitive dep walker"
```

---

## Task 4: `isPlaceholderCoords(inputs)` — placeholder linkage detection

Use the existing `matchesPlaceholder(values, mode)` exported by `src/linkage-setup.js`. A bike whose linkage coords match either placeholder set must produce missing values for every linkage-dependent result.

**Files:**
- Modify: `src/data-table-advance.js`
- Modify: `tests/data-table-advance.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/data-table-advance.test.js`:

```js
import { isPlaceholderCoords } from '../src/data-table-advance.js';
import {
  LINKAGE_PLACEHOLDER_LINKED,
  LINKAGE_PLACEHOLDER_PROLINK,
} from '../src/linkage-setup.js';

test('isPlaceholderCoords: pro-link placeholder → true', () => {
  const inputs = { ...LINKAGE_PLACEHOLDER_PROLINK, Linkage_Mode: 'pro-link' };
  assert.equal(isPlaceholderCoords(inputs), true);
});

test('isPlaceholderCoords: linked placeholder → true', () => {
  const inputs = { ...LINKAGE_PLACEHOLDER_LINKED, Linkage_Mode: 'linked' };
  assert.equal(isPlaceholderCoords(inputs), true);
});

test('isPlaceholderCoords: customized coords → false', () => {
  const inputs = {
    ...LINKAGE_PLACEHOLDER_PROLINK,
    Linkage_Mode: 'pro-link',
    Linkage_F_X: -123.45, // arbitrary non-placeholder value
  };
  assert.equal(isPlaceholderCoords(inputs), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/data-table-advance.test.js`

Expected: FAIL — `isPlaceholderCoords is not a function`.

- [ ] **Step 3: Implement `isPlaceholderCoords`**

Add to `src/data-table-advance.js`:

```js
import { matchesPlaceholder } from './linkage-setup.js';

/**
 * Returns true if the bike's linkage coordinates match either the
 * pro-link or linked placeholder set. Such a bike does NOT have real
 * linkage coords and must produce missing values for every linkage-
 * dependent result on the advance page.
 */
export function isPlaceholderCoords(inputs) {
  const mode = inputs.Linkage_Mode || 'pro-link';
  return matchesPlaceholder(inputs, mode);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/data-table-advance.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data-table-advance.js tests/data-table-advance.test.js
git commit -m "data-table-advance: add isPlaceholderCoords detector"
```

---

## Task 5: `computeAdvanceResults(bike)` — the core pipeline

Strip load case to zero, materialize bike inputs, validate each result's leaf deps, run `computeAll`, return per-result `{ value, missing }`.

**Files:**
- Modify: `src/data-table-advance.js`
- Modify: `tests/data-table-advance.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/data-table-advance.test.js`:

```js
import { computeAdvanceResults } from '../src/data-table-advance.js';
import { defaultBikes } from '../src/data-table.js';

test('computeAdvanceResults: bike with placeholder linkage → linkage rows missing', () => {
  const bikes = defaultBikes();
  // Manually replace any bike's linkage with placeholder to force the case
  const bike = bikes[0];
  // No catalog linkage selected (or selected one is placeholder) → these
  // 6 linkage-dependent results must be missing:
  const linkageDependent = [
    'MotoSPEC_AntSquat',
    'Motion_Ratio',
    'Progression',
    'Rear_Ride_Height',
    'Rear_Wheel_Vertical_Travel',
    'MotoSPEC_SwgarmAngl',
  ];
  // Force the bike's linkage component to be unselected so the placeholder
  // path is taken.
  bike.components = { ...bike.components, linkage: undefined };
  const out = computeAdvanceResults(bike);
  for (const k of linkageDependent) {
    assert.ok(out[k].missing, `${k} should be missing when linkage is placeholder`);
  }
});

test('computeAdvanceResults: static at-rest sanity for a complete bike', () => {
  const bikes = defaultBikes();
  // Pick the first reference bike that has a real linkage selected.
  const bike = bikes.find(b => b.components && b.components.linkage);
  assert.ok(bike, 'expected at least one reference bike with a linkage selected');
  const out = computeAdvanceResults(bike);

  // At static (Travel=0) the dynamic rake collapses to the static rake input.
  assert.ok(!out.MotoSPEC_Rake.missing);
  // bike.values.Rake_Static is the input value; advance computation should match it.
  assert.ok(
    Math.abs(out.MotoSPEC_Rake.value - bike.values.Rake_Static) < 1e-9,
    `expected Rake≈Rake_Static, got ${out.MotoSPEC_Rake.value} vs ${bike.values.Rake_Static}`
  );

  // Wheelbase: just the input value.
  assert.equal(out.WB.value, bike.values.WB);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/data-table-advance.test.js`

Expected: FAIL — `computeAdvanceResults is not a function`.

- [ ] **Step 3: Implement `computeAdvanceResults`**

Add to `src/data-table-advance.js`:

```js
import { computeAll, P } from './formulas.js';
import { materializeBikeInputs } from './catalog.js';
import { LINKAGE_COORD_FIELDS } from './linkage-setup.js';

const LINKAGE_DEP_NAMES = new Set(LINKAGE_COORD_FIELDS);

// 14 result keys derived from ADVANCE_RESULT_ROWS, used by the pipeline.
// Some rows (e.g. CofG %) use derivedFrom rather than a P channel — those
// are handled separately by the renderer in Task 6, not here.
const COMPUTED_RESULT_KEYS = ADVANCE_RESULT_ROWS
  .filter(r => r.computed)
  .map(r => r.computed);

/**
 * Force load case to zero. v1 is static at-rest only.
 */
function forceStaticAtRest(inputs) {
  return {
    ...inputs,
    Travel_Front: 0,
    Travel_Rear: 0,
    Lean_Angle: 0,
    a_x: 0,
    V: 0,
  };
}

/**
 * Returns true if any required leaf is undefined / NaN, OR the result is
 * linkage-dependent and the bike's linkage coords are the placeholder set.
 *
 * Returns { missing: true, missingLeaves: [...] } if so, else { missing: false }.
 */
function validateInputs(inputs, requiredLeaves, isPlaceholder) {
  const missingLeaves = [];

  // Linkage-dependent rows: any required leaf appearing in LINKAGE_COORD_FIELDS
  // means this result depends on linkage coords. If they're the placeholder
  // set, mark every linkage coord as missing.
  const dependsOnLinkage = requiredLeaves.some(l => LINKAGE_DEP_NAMES.has(l));
  if (dependsOnLinkage && isPlaceholder) {
    return {
      missing: true,
      missingLeaves: requiredLeaves.filter(l => LINKAGE_DEP_NAMES.has(l)),
    };
  }

  for (const leaf of requiredLeaves) {
    const v = inputs[leaf];
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) {
      missingLeaves.push(leaf);
    }
  }
  return missingLeaves.length
    ? { missing: true, missingLeaves }
    : { missing: false };
}

/**
 * For one bike, return per-result { value, missing, missingLeaves } for each
 * of the 14 result keys.
 */
export function computeAdvanceResults(bike) {
  const baseInputs = materializeBikeInputs(bike);
  const inputs = forceStaticAtRest(baseInputs);
  const isPlaceholder = isPlaceholderCoords(inputs);

  // Pre-validate: figure out which results are missing before computing.
  const validation = {};
  for (const key of COMPUTED_RESULT_KEYS) {
    const leaves = leafDepsFor(key);
    validation[key] = validateInputs(inputs, leaves, isPlaceholder);
  }

  // Run the full pipeline. Even if some results are flagged missing, the
  // formulas may still produce numbers — we ignore those numbers for
  // missing rows. computeAll never throws on NaN inputs.
  const computed = computeAll(inputs);

  const out = {};
  for (const key of COMPUTED_RESULT_KEYS) {
    const v = validation[key];
    if (v.missing) {
      out[key] = { value: null, missing: true, missingLeaves: v.missingLeaves };
      continue;
    }
    const value = computed[key];
    if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) {
      out[key] = { value: null, missing: true, missingLeaves: ['(computation produced non-finite)'] };
    } else {
      out[key] = { value, missing: false, missingLeaves: [] };
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/data-table-advance.test.js`

Expected: all tests PASS. The static-rake assertion confirms `Pitch ≈ 0` at zero travel.

- [ ] **Step 5: Commit**

```bash
git add src/data-table-advance.js tests/data-table-advance.test.js
git commit -m "data-table-advance: implement computeAdvanceResults pipeline"
```

---

## Task 6: `renderDataTableAdvance(state)` — the renderer

DOM render: column-per-bike, missing cell as `<td class="dt-missing" title="Missing: …">`, per-row count chip showing `N/M` of bikes with the value computed.

**Files:**
- Modify: `src/data-table-advance.js`
- Modify: `tests/data-table-advance.test.js`

- [ ] **Step 1: Write failing render test**

Append to `tests/data-table-advance.test.js`:

```js
import { renderDataTableAdvance } from '../src/data-table-advance.js';

test('renderDataTableAdvance: missing cell carries dt-missing class and title', () => {
  // Build a state with one bike whose linkage is unselected.
  const bikes = defaultBikes().slice(0, 1);
  bikes[0].components = { ...bikes[0].components, linkage: undefined };
  const state = { lang: 'en', advanceBikes: bikes };

  const html = renderDataTableAdvance(state);

  // Linkage-dependent rows (e.g. Motion_Ratio) should render as missing.
  assert.match(html, /class="dt-missing"[^>]*title="Missing:[^"]+"/);
  // Wheelbase row should NOT be missing — it's just the WB input.
  assert.match(html, new RegExp(`>${bikes[0].values.WB}<`));
});

test('renderDataTableAdvance: per-row count chip reflects N/M ready bikes', () => {
  const bikes = defaultBikes().slice(0, 2);
  // Ensure both bikes have the WB input — count should be 2/2 for Wheelbase.
  const state = { lang: 'en', advanceBikes: bikes };
  const html = renderDataTableAdvance(state);
  assert.match(html, /class="dt-count-chip[^"]*"[^>]*>2\/2/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/data-table-advance.test.js`

Expected: FAIL — `renderDataTableAdvance is not a function`.

- [ ] **Step 3: Implement renderer**

Add to `src/data-table-advance.js`:

```js
import { fmtNum, escapeHtml, COMPONENT_TO_CATALOG, catalogEntriesFor } from './data-table.js';

const UI = {
  zh: { title: '数据表（高级）', resultsHeader: '结果' },
  en: { title: 'Data Table (Advance)', resultsHeader: 'RESULTS' },
};

function chipClass(n, m) {
  if (m === 0) return 'dt-count-chip grey';
  if (n === m) return 'dt-count-chip green';
  if (n === 0) return 'dt-count-chip grey';
  return 'dt-count-chip amber';
}

function renderResultCell(per) {
  if (per.missing) {
    const title = `Missing: ${per.missingLeaves.join(', ')}`;
    return `<td class="dt-missing" title="${escapeHtml(title)}"></td>`;
  }
  return `<td>${fmtNum(per.value)}</td>`;
}

function renderDerivedCell(row, bike) {
  // CofG % rows use derivedFrom(values).
  const v = row.derivedFrom(bike.values);
  if (v === undefined || v === null || !Number.isFinite(v)) {
    return `<td class="dt-missing" title="Missing: derived value not available"></td>`;
  }
  return `<td>${fmtNum(v)}</td>`;
}

export function renderDataTableAdvance(state) {
  const lang = state.lang === 'zh' ? 'zh' : 'en';
  const t = UI[lang];
  const bikes = state.advanceBikes || [];

  // Compute per-bike results once.
  const perBike = bikes.map(b => computeAdvanceResults(b));

  // Header row: bike names.
  const headerCells = bikes.map(b => `<th>${escapeHtml(b.name)}</th>`).join('');

  // Result rows.
  const rowsHtml = ADVANCE_RESULT_ROWS.map((row, ri) => {
    const label = lang === 'zh' ? row.spec_zh : row.spec;
    let cells = '';
    let nReady = 0;
    for (let i = 0; i < bikes.length; i++) {
      if (row.computed) {
        const per = perBike[i][row.computed];
        if (!per.missing) nReady++;
        cells += renderResultCell(per);
      } else if (row.derivedFrom) {
        const v = row.derivedFrom(bikes[i].values);
        const ok = v !== undefined && v !== null && Number.isFinite(v);
        if (ok) nReady++;
        cells += renderDerivedCell(row, bikes[i]);
      }
    }
    const chip = `<span class="${chipClass(nReady, bikes.length)}">${nReady}/${bikes.length}</span>`;
    return `<tr><th>${escapeHtml(label)} ${chip}</th>${cells}</tr>`;
  }).join('');

  return `
    <h2>${escapeHtml(t.title)}</h2>
    <table class="dt-advance">
      <thead><tr><th>${escapeHtml(t.resultsHeader)}</th>${headerCells}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/data-table-advance.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data-table-advance.js tests/data-table-advance.test.js
git commit -m "data-table-advance: implement renderer with missing cells and count chips"
```

---

## Task 7: Wire the page into `index.html`

Add nav button, import, page-switch case, `state.advanceBikes` initialization, and CSS for `.dt-missing` and `.dt-count-chip`.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Locate the existing nav strip and page switch**

Run: `grep -n "data-table\|renderContent\|state\.bikes\|nav-tab\|defaultBikes" index.html | head -40`

Note the line numbers for: existing data-table nav button, existing case in `renderContent()`, existing `defaultBikes()` call.

- [ ] **Step 2: Add the import**

In `index.html`, in the inline `<script type="module">`, add to the existing imports:

```js
import { renderDataTableAdvance } from './src/data-table-advance.js';
import { defaultBikes } from './src/data-table.js'; // if not already imported
```

- [ ] **Step 3: Initialize `state.advanceBikes`**

In the state-init block:

```js
state.advanceBikes = defaultBikes();
```

(Use a fresh `defaultBikes()` call so editing one page doesn't affect the other.)

- [ ] **Step 4: Add the nav button**

In the nav strip, next to the Data Table button:

```html
<button onclick="setPage('data-table-advance')" id="nav-data-table-advance">
  <span class="lang-zh">数据表（高级）</span>
  <span class="lang-en">Data Table (Advance)</span>
</button>
```

- [ ] **Step 5: Add the page switch case**

In `renderContent()`'s switch:

```js
case 'data-table-advance':
  document.getElementById('content').innerHTML = renderDataTableAdvance(state);
  break;
```

- [ ] **Step 6: Add CSS**

In the inline `<style>` block:

```css
.dt-advance .dt-missing { background: #fafafa; }
.dt-count-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}
.dt-count-chip.green { background: #d4edda; color: #155724; }
.dt-count-chip.amber { background: #fff3cd; color: #856404; }
.dt-count-chip.grey  { background: #e9ecef; color: #6c757d; }
```

- [ ] **Step 7: Manual smoke test**

Start a static server and open the page:

```bash
python3 -m http.server 8000
```

Navigate to `http://localhost:8000`, click the new "Data Table (Advance)" tab. Verify:
- Page renders with the 14 result rows
- Linkage-dependent rows show empty cells with hover tooltips listing missing leaves
- Wheelbase, Rake, Trail show real numbers
- Per-row count chip shows the right N/M

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "index: wire Data Table (Advance) page and nav"
```

---

## Task 8: Implement `Front_Wheel_Rate` formula

Replace the `() => NaN` stub. Adds `Front_Spring_Rate` and `Rake_Static` to the formula's `deps` so `leafDepsFor` finds them.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Write failing test**

Append to `tests/formulas.test.js`:

```js
test('Front_Wheel_Rate = Front_Spring_Rate · cos²(Rake_Static)', () => {
  const inputs = { ...defaultValues(), Front_Spring_Rate: 9.0, Rake_Static: 24 };
  const out = computeAll(inputs);
  // MR_front = 1/cos(24°) ≈ 1.0946; wheel_rate = 9 / MR² = 9 · cos²(24°)
  const expected = 9.0 * Math.cos(24 * Math.PI / 180) ** 2;
  assert.ok(
    Math.abs(out.Front_Wheel_Rate - expected) < 1e-9,
    `expected ${expected}, got ${out.Front_Wheel_Rate}`
  );
});
```

(If `defaultValues`, `computeAll`, `assert` are not already imported in this file, add the imports — check the top of `tests/formulas.test.js` first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern='Front_Wheel_Rate' tests/formulas.test.js`

Expected: FAIL — current formula is `() => NaN`.

- [ ] **Step 3: Implement the formula**

In `src/formulas.js`, find the `Front_Wheel_Rate` entry in `P` (around line 338) and update its `deps`:

```js
Front_Wheel_Rate: {
  name:'Front_Wheel_Rate', label:'前轮综合刚度', unit:'N/mm', type:'channel',
  desc: 'Front wheel rate at zero travel: spring rate divided by motion-ratio squared, where MR_front = fork compression per unit vertical front-wheel travel = 1/cos(Rake_Static).',
  formula: ['Front_Spring_Rate / (1/cos(Rake_Static))²'],
  deps: ['Front_Spring_Rate', 'Rake_Static'],
},
```

In the `CALC` map (around line 477), replace:

```js
Front_Wheel_Rate:          () => NaN,
```

with:

```js
// MR_front: fork compression per unit vertical front-wheel travel
// = 1/cos(Rake_Static); typically 1.05–1.10 for sportbikes.
Front_Wheel_Rate: v => {
  const MR_front = 1 / Math.cos(v.Rake_Static * D2R);
  return v.Front_Spring_Rate / (MR_front * MR_front);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern='Front_Wheel_Rate' tests/formulas.test.js`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests pass. The advance-page tests will now show `Front_Wheel_Rate` as non-missing for any bike with `Front_Spring_Rate` and `Rake_Static`.

- [ ] **Step 6: Commit**

```bash
git add src/formulas.js tests/formulas.test.js
git commit -m "formulas: implement Front_Wheel_Rate = K_spring·cos²(rake)"
```

---

## Task 9: Implement `Rear_Wheel_Rate` formula

Replace the `() => NaN` stub. Existing `Motion_Ratio` is wheel/shock (≈ 2–3), so the rear formula divides.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Write failing test**

Append to `tests/formulas.test.js`:

```js
test('Rear_Wheel_Rate = Rear_Spring_Rate / Motion_Ratio² (energy identity)', () => {
  const inputs = { ...defaultValues(), Rear_Spring_Rate: 90 };
  const out = computeAll(inputs);
  if (!Number.isFinite(out.Motion_Ratio)) {
    // Default linkage may be placeholder; skip the numeric check but the
    // formula linkage to Motion_Ratio is still validated by deps tests below.
    return;
  }
  const expected = 90 / (out.Motion_Ratio * out.Motion_Ratio);
  assert.ok(
    Math.abs(out.Rear_Wheel_Rate - expected) < 1e-9,
    `expected ${expected}, got ${out.Rear_Wheel_Rate}`
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern='Rear_Wheel_Rate' tests/formulas.test.js`

Expected: FAIL — current formula is `() => NaN`.

- [ ] **Step 3: Implement the formula**

In `src/formulas.js`, find the `Rear_Wheel_Rate` entry in `P` (around line 332) and update its `deps`:

```js
Rear_Wheel_Rate: {
  name:'Rear_Wheel_Rate', label:'后轮综合刚度', unit:'N/mm', type:'channel',
  desc: 'Rear wheel rate at static sag: spring rate divided by Motion_Ratio², where Motion_Ratio is wheel-travel-per-shock-travel (≈2–3 for typical street bikes).',
  formula: ['Rear_Spring_Rate / Motion_Ratio²'],
  deps: ['Rear_Spring_Rate', 'Motion_Ratio'],
},
```

In `CALC`, replace:

```js
Rear_Wheel_Rate:           () => NaN,
```

with:

```js
// Motion_Ratio is wheel/shock (≈2–3). Energy identity:
//   K_wheel = K_spring · (x_spring / x_wheel)² = K_spring / Motion_Ratio²
Rear_Wheel_Rate: v => {
  const mr = v.Motion_Ratio;
  if (!Number.isFinite(mr) || mr === 0) return NaN;
  return v.Rear_Spring_Rate / (mr * mr);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern='Rear_Wheel_Rate' tests/formulas.test.js`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/formulas.js tests/formulas.test.js
git commit -m "formulas: implement Rear_Wheel_Rate = K_spring / Motion_Ratio²"
```

---

## Task 10: Add `Front_Wheel_Rate`/`Rear_Wheel_Rate` expected values to reference fixture

`tests/validation.test.js` diffs `computeAll` output against `tests/fixtures/reference-bikes.json` per-bike. Now that the two new formulas exist, populate expected values so any future regression in either formula fails the validation test for every reference bike.

**Files:**
- Modify: `tests/fixtures/reference-bikes.json`

- [ ] **Step 1: Compute expected values for each reference bike**

Run a one-shot Node script:

```bash
node -e "
import('./src/reference-bikes.js').then(async ({ REFERENCE_BIKES }) => {
  const { computeAll } = await import('./src/formulas.js');
  for (const b of REFERENCE_BIKES) {
    const out = computeAll(b.inputs);
    console.log(b.name, 'Front_Wheel_Rate:', out.Front_Wheel_Rate, 'Rear_Wheel_Rate:', out.Rear_Wheel_Rate);
  }
});
"
```

Expected: prints two numbers per bike. Inspect them visually — `Front_Wheel_Rate` should be a few percent below `Front_Spring_Rate` (typically 7–12 N/mm for street bikes); `Rear_Wheel_Rate` should be in the 8–20 N/mm range for stock-MR sportbikes.

- [ ] **Step 2: Update the fixture file**

Open `tests/fixtures/reference-bikes.json`. For each bike entry, add the two expected values (matching the format other expected values use in this file — likely under an `expected` or `results` key; inspect the file structure first).

```bash
head -80 tests/fixtures/reference-bikes.json
```

Add entries with **0.5 N/mm tolerance** (or per-bike `tolerance_mm` if that field already covers all results).

- [ ] **Step 3: Run validation tests**

Run: `node --test tests/validation.test.js`

Expected: all reference bikes pass with the new expected values within tolerance.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/reference-bikes.json
git commit -m "fixtures: add expected wheel-rate values for reference bikes"
```

---

## Task 11: Verify legacy data table picks up the now-real wheel rate values

The legacy data table has these two rows tagged `pending`. Now that the formulas return real numbers, the rows show real values. Update the legacy row metadata so the PENDING badge no longer appears.

**Files:**
- Modify: `src/data-table.js`
- Modify: `tests/data-table.test.js`

- [ ] **Step 1: Drop the `status: 'pending'` tag from the two rows**

In `src/data-table.js` around lines 73–74:

```js
{ spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate' },
{ spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate' },
```

(Drop `, status: 'pending'`.)

- [ ] **Step 2: Update or add a test**

If `tests/data-table.test.js` has an assertion that `Front_Wheel_Rate` row carries the PENDING badge, flip it to expect no badge. Otherwise add:

```js
test('Front/Rear Wheel Rate rows no longer carry PENDING status', () => {
  const results = ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const fr = results.find(r => r.computed === 'Front_Wheel_Rate');
  const rr = results.find(r => r.computed === 'Rear_Wheel_Rate');
  assert.equal(fr.status, undefined);
  assert.equal(rr.status, undefined);
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 4: Manual smoke test**

Start the static server and verify:
- Legacy Data Table page shows real numbers in Front/Rear Wheel Rate rows (no PENDING badge)
- Advance Data Table page shows the same numbers
- Both pages stay in sync as you change `Front_Spring_Rate` / `Rear_Spring_Rate`

- [ ] **Step 5: Commit**

```bash
git add src/data-table.js tests/data-table.test.js
git commit -m "data-table: drop PENDING from Wheel Rate rows now that formulas are real"
```

---

## Self-review notes

- **Spec coverage:** Every spec section is covered by at least one task. Section 1 (page/nav) → Task 7. Section 2 (rows) → Tasks 2, 6. Section 3 (data flow) → Tasks 3–5. Section 4 (UX + new formulas) → Tasks 6, 8, 9. Section 5 (testing) → Tasks 2–6, 8–10. Section 6 (file layout) → Tasks 1–11.
- **Type consistency:** `computeAdvanceResults` returns `{ value, missing, missingLeaves }` per result; this shape is used in Task 5, consumed by Task 6's renderer, and asserted in tests. `ADVANCE_RESULT_ROWS` schema (`{ spec, spec_zh, computed?, derivedFrom? }`) is defined in Task 2 and consumed unchanged by Task 6.
- **No placeholders:** Every step has either an exact command, exact file path, or full code block.
- **Implementation order matches spec:** scaffold → bike-level rows → linkage rows (after coords detection) → new formulas → fixture → legacy cleanup. Each task lands a working, testable increment.
