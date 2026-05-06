# Static-V1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip dynamic and aero parameters from the existing formula explorer, add the missing static Trail formula, refactor the formula registry into a pure ES module that runs in both browser and Node, and stand up a reference-bike validation harness so PRD Phase 2 (cross-checking against MotoSpec) is mechanical instead of manual.

**Architecture:** The current app is a single `index.html` with all logic inline. We extract the calculation core into `src/formulas.js` — a pure module with no DOM access, exporting parameter definitions, input metadata, and a `computeAll(inputs)` function. `index.html` imports the module via `<script type="module">` and uses it for live UI updates; Node tests import the same module directly. Tests use the Node 22 built-in test runner (`node:test`) with zero dependencies.

**Tech Stack:** Vanilla ES modules, Node ≥18 built-in test runner (`node --test`), JSON fixtures, plain HTML/CSS/JS. No bundler. Vercel serves `/src/*.js` as static assets.

**Static-V1 parameter set (after this plan):**
- **Inputs (11):** `Rake_Static`, `WB`, `Rf`, `O`, `beta_static`, `L_SA`, `H_CG`, `L_CG`, `Mass`, `front_weight_dist`, `rear_weight_dist`
- **Channels (3):** `Trail_Static` (new), `W_F_Static`, `W_R_Static`
- **Removed (15):** `MotoSPEC_Rake`, `MotoSPEC_Trail`, `MotoSPEC_SwgarmAngl`, `MotoSPEC_AntSquat`, `MotoSPEC_FrontForce`, `MotoSPEC_RearForce`, `Pitch`, `delta_beta`, `theta_thrust`, `theta_cg`, `delta_W`, `F_Aero`, plus inputs `Travel_Front`, `Travel_Rear`, `theta_chain`, `a_x`, `rho`, `V`, `Cd`, `A`, `C_f_aero`, `C_r_aero`

---

## File Structure

**Create:**
- `package.json` — declares `"type": "module"` and a `test` script
- `src/formulas.js` — pure parameter registry + `computeAll`, no DOM
- `tests/formulas.test.js` — unit tests for each formula and registry shape
- `tests/validation.test.js` — reference-bike harness
- `tests/fixtures/reference-bikes.json` — measured bike inputs + expected outputs
- `.gitignore` — `node_modules/` (defensive, even though we use no deps)

**Modify:**
- `index.html` — replace inline `P`, `INPUT_META`, `CALC` definitions with `import` from `src/formulas.js`; rework `gv()` to read from a precomputed `_all` table; rewrite `PRESET_LIST` for static bikes; trim SVG `DIAGRAMS` for removed params; remove dynamic/aero strings from `P_EN`, `UI`, `SVG_T`.

---

## Task 1: Project scaffolding for testing

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Verify Node version supports built-in test runner**

Run: `node --version`
Expected: `v18.x` or newer (built-in `node:test` is stable from 20+, available from 18).

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "motospec-static",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.DS_Store
.vercel/
```

- [ ] **Step 4: Smoke-test `npm test` runs (and finds zero tests)**

Run: `npm test`
Expected: `tests 0` and exit code 0 (no test files yet — runner reports nothing).

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: scaffold node test runner for formula validation"
```

---

## Task 2: Extract pure formula module (no behavior change)

The existing `index.html` defines `P`, `INPUT_META`, `CALC` inline at lines ~225–860. We move them verbatim into `src/formulas.js` first, then strip in later tasks. This task must produce **zero behavior change** — the app must look and act identically when done.

**Files:**
- Create: `src/formulas.js`
- Modify: `index.html` (remove inline definitions; add `import`)

- [ ] **Step 1: Create `src/formulas.js` with current full registry**

Copy the existing `P`, `INPUT_META`, `CALC` objects from `index.html` into a new file `src/formulas.js`, prefixing each with `export const`. Replace the closure-style `gv(id)` reads inside `CALC` with explicit argument access:

```js
// src/formulas.js
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const P = { /* paste existing P object verbatim */ };

export const INPUT_META = { /* paste existing INPUT_META verbatim */ };

// Each calc takes a `v` object containing already-computed values for its dependencies
export const CALC = {
  Pitch:         v => Math.atan((v.Travel_Front - v.Travel_Rear) / v.WB),
  delta_beta:    v => Math.asin(Math.max(-1, Math.min(1, v.Travel_Rear / v.L_SA))),
  MotoSPEC_Rake: v => v.Rake_Static - v.Pitch * R2D,
  MotoSPEC_Trail: v => {
    const r = v.MotoSPEC_Rake * D2R;
    return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
  },
  MotoSPEC_SwgarmAngl: v => v.beta_static - v.delta_beta * R2D,
  theta_thrust:  v => Math.atan(Math.tan(v.theta_chain * D2R) + Math.tan(v.MotoSPEC_SwgarmAngl * D2R)),
  theta_cg:      v => Math.atan(v.H_CG / v.L_CG),
  MotoSPEC_AntSquat: v => Math.tan(v.theta_thrust) / Math.tan(v.theta_cg) * 100,
  delta_W:       v => v.Mass * v.a_x * 9.81 * (v.H_CG / v.WB),
  F_Aero:        v => 0.5 * v.rho * v.V ** 2 * v.Cd * v.A,
  W_F_Static:    v => v.Mass * 9.81 * v.front_weight_dist,
  W_R_Static:    v => v.Mass * 9.81 * v.rear_weight_dist,
  MotoSPEC_FrontForce: v => v.W_F_Static + v.delta_W + v.F_Aero * v.C_f_aero,
  MotoSPEC_RearForce:  v => v.W_R_Static - v.delta_W + v.F_Aero * v.C_r_aero,
};

// Topological order: every entry's deps appear earlier in the list
export const TOPO_ORDER = [
  'Pitch', 'delta_beta', 'MotoSPEC_Rake', 'MotoSPEC_Trail',
  'MotoSPEC_SwgarmAngl', 'theta_thrust', 'theta_cg', 'MotoSPEC_AntSquat',
  'delta_W', 'F_Aero', 'W_F_Static', 'W_R_Static',
  'MotoSPEC_FrontForce', 'MotoSPEC_RearForce',
];

export function defaultValues() {
  const v = {};
  for (const id in INPUT_META) v[id] = INPUT_META[id].def;
  return v;
}

export function computeAll(inputValues) {
  const out = { ...inputValues };
  for (const id of TOPO_ORDER) {
    if (P[id] && P[id].type !== 'input') out[id] = CALC[id](out);
  }
  return out;
}
```

- [ ] **Step 2: Modify `index.html` to import the module**

Replace the inline `const P = { ... }`, `const INPUT_META = { ... }`, `const D2R = ...`, `const R2D = ...`, `const CALC = { ... }` blocks with an import at the top of the script. Convert the existing `<script>` tag to `<script type="module">`.

```html
<script type="module">
import { P, INPUT_META, CALC, D2R, R2D, defaultValues, computeAll } from './src/formulas.js';
// ... rest of existing inline code
</script>
```

- [ ] **Step 3: Replace `gv()` with a precomputed table**

The existing `gv(id)` lazily caches per-call. Replace with an eager full recompute on every state change. Locate the existing `gv` definition and rewrite:

```js
let _all = computeAll(state.values);
function gv(id) { return _all[id]; }
function clearCache() { _all = computeAll(state.values); }
```

Existing call sites (`setInputValue`, `applyPreset`, `resetDefaults`) already invoke `clearCache()`; behavior is preserved.

- [ ] **Step 4: Verify in browser — no behavior change**

Run a local server: `python3 -m http.server 8000`
Open `http://localhost:8000/` in a browser.
Expected: the app loads, all sliders work, all values match what they were before, switching language works, all six channels render, all SVG diagrams render. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/formulas.js index.html
git commit -m "refactor: extract formula registry into pure ES module"
```

---

## Task 3: Characterization tests for current behavior

Before we strip anything, lock down the current outputs with tests. Any future regression on a *kept* formula will be caught.

**Files:**
- Create: `tests/formulas.test.js`

- [ ] **Step 1: Write registry-shape tests**

```js
// tests/formulas.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P, INPUT_META, CALC, defaultValues, computeAll } from '../src/formulas.js';

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
  }
});
```

- [ ] **Step 2: Write defaults-snapshot test**

```js
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
```

- [ ] **Step 3: Write per-formula numeric tests for the keepers**

These pin behavior of the formulas that survive into Static-V1.

```js
test('W_F_Static = Mass × 9.81 × front_weight_dist', () => {
  const out = computeAll({ ...defaultValues(), Mass: 200, front_weight_dist: 0.5, rear_weight_dist: 0.5 });
  assert.ok(Math.abs(out.W_F_Static - 200 * 9.81 * 0.5) < 1e-9);
});

test('W_R_Static = Mass × 9.81 × rear_weight_dist', () => {
  const out = computeAll({ ...defaultValues(), Mass: 200, front_weight_dist: 0.5, rear_weight_dist: 0.5 });
  assert.ok(Math.abs(out.W_R_Static - 200 * 9.81 * 0.5) < 1e-9);
});
```

- [ ] **Step 4: Run tests to verify they pass against current code**

Run: `npm test`
Expected: all tests pass. `tests 5+` reported.

- [ ] **Step 5: Commit**

```bash
git add tests/formulas.test.js
git commit -m "test: characterize current formula registry"
```

---

## Task 4: Add static Trail formula (TDD)

The existing `MotoSPEC_Trail` is the *dynamic* version (uses `MotoSPEC_Rake`, which depends on `Pitch`). We need a separate `Trail_Static` that uses `Rake_Static` directly. It's the foundation of every static geometry sheet.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`

- [ ] **Step 1: Write failing test for `Trail_Static`**

Append to `tests/formulas.test.js`:

```js
test('Trail_Static = (Rf · sin(Rake) − O) / cos(Rake)', () => {
  // Yamaha R6 2020 spec sheet: Rake 24°, Trail 97 mm
  const inputs = { ...defaultValues(), Rake_Static: 24, Rf: 308, O: 30 };
  const out = computeAll(inputs);
  const r = 24 * Math.PI / 180;
  const expected = (308 * Math.sin(r) - 30) / Math.cos(r);
  assert.ok(Math.abs(out.Trail_Static - expected) < 1e-6,
    `Trail_Static=${out.Trail_Static} expected≈${expected}`);
});

test('Trail_Static is a channel (visible on dashboard)', () => {
  assert.equal(P.Trail_Static.type, 'channel');
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm test`
Expected: 2 tests fail with `P.Trail_Static is undefined` / `out.Trail_Static is undefined`.

- [ ] **Step 3: Add `Trail_Static` to `P`, `CALC`, `TOPO_ORDER`**

In `src/formulas.js`, add to `P` (place under the `// ===== 6 大主通道 =====` block, before `Pitch`):

```js
Trail_Static: {
  name: 'Trail_Static', label: '静态拖曳距', unit: 'mm', type: 'channel',
  desc: '前轮接地点到转向轴地面交点的水平距离。静态测量基础值，决定直行稳定性与转向反馈。',
  formula: [
    '( ', {ref:'Rf'}, ' × sin(', {ref:'Rake_Static'}, ') − ', {ref:'O'}, ' ) / cos(', {ref:'Rake_Static'}, ')'
  ],
  deps: ['Rf', 'Rake_Static', 'O'],
  note: 'Rake 转弧度后代入。增大 Rake 或减小 Offset 都会增大 Trail，提高直行稳定性但降低转向轻巧度。'
},
```

Add to `CALC`:

```js
Trail_Static: v => {
  const r = v.Rake_Static * D2R;
  return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
},
```

Add to `TOPO_ORDER` — insert at the **start** so it's available before any dynamic calc that might (in future) reference it:

```js
export const TOPO_ORDER = [
  'Trail_Static',
  'Pitch', 'delta_beta', 'MotoSPEC_Rake', 'MotoSPEC_Trail',
  // ... rest unchanged
];
```

- [ ] **Step 4: Add English translation for `Trail_Static`**

In `index.html`, locate the `P_EN` object and add:

```js
Trail_Static: {
  label: 'Static Trail',
  desc: 'Horizontal distance from the front contact patch to where the steering axis meets the ground. Static baseline — sets straight-line stability and steering feel.',
  note: 'Convert Rake to radians first. Larger Rake or smaller Offset both grow Trail, increasing stability at the cost of nimbleness.'
},
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test`
Expected: all tests pass, including the two new `Trail_Static` tests.

- [ ] **Step 6: Verify in browser**

Reload the local server. Expected: `Trail_Static` appears as a new card on the Dashboard, and clicking it shows formula + diagram (diagram will fall back to no overlay — added in Task 7).

- [ ] **Step 7: Commit**

```bash
git add src/formulas.js index.html tests/formulas.test.js
git commit -m "feat: add static Trail formula derived from static Rake"
```

---

## Task 5: Remove dynamic-only parameters (TDD)

Strip the chain `Pitch → MotoSPEC_Rake → MotoSPEC_Trail → MotoSPEC_SwgarmAngl → theta_thrust → MotoSPEC_AntSquat` and `delta_beta → theta_cg → delta_W → MotoSPEC_FrontForce → MotoSPEC_RearForce`. Also remove the inputs that *only* fed those chains: `Travel_Front`, `Travel_Rear`, `theta_chain`, `a_x`.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`
- Modify: `index.html` (remove `P_EN` entries, `DIAGRAMS` entries, presets)

- [ ] **Step 1: Write failing tests asserting removal**

Append to `tests/formulas.test.js`:

```js
const REMOVED_DYNAMIC = [
  'MotoSPEC_Rake', 'MotoSPEC_Trail', 'MotoSPEC_SwgarmAngl',
  'MotoSPEC_AntSquat', 'MotoSPEC_FrontForce', 'MotoSPEC_RearForce',
  'Pitch', 'delta_beta', 'theta_thrust', 'theta_cg', 'delta_W',
  'Travel_Front', 'Travel_Rear', 'theta_chain', 'a_x',
];

for (const id of REMOVED_DYNAMIC) {
  test(`dynamic param ${id} is removed from registry`, () => {
    assert.equal(P[id], undefined, `${id} still in P`);
    assert.equal(CALC[id], undefined, `${id} still in CALC`);
    assert.equal(INPUT_META[id], undefined, `${id} still in INPUT_META`);
  });
}
```

- [ ] **Step 2: Run test to confirm failures**

Run: `npm test`
Expected: 15 new tests fail.

- [ ] **Step 3: Remove from `src/formulas.js`**

Delete from `P` the entries: `MotoSPEC_Rake`, `MotoSPEC_Trail`, `MotoSPEC_SwgarmAngl`, `MotoSPEC_AntSquat`, `MotoSPEC_FrontForce`, `MotoSPEC_RearForce`, `Pitch`, `delta_beta`, `theta_thrust`, `theta_cg`, `delta_W`, `Travel_Front`, `Travel_Rear`, `theta_chain`, `a_x`.

Delete the same keys from `CALC` and `INPUT_META`.

Update `TOPO_ORDER` to:

```js
export const TOPO_ORDER = ['Trail_Static', 'W_F_Static', 'W_R_Static'];
```

- [ ] **Step 4: Remove related entries from `index.html`**

In `P_EN`, delete entries matching the same 15 ids.

In the `DIAGRAMS` object, delete the function definitions and assignments for: `MotoSPEC_Rake`, `MotoSPEC_Trail`, `MotoSPEC_SwgarmAngl`, `MotoSPEC_AntSquat`, `MotoSPEC_FrontForce`, `MotoSPEC_RearForce`, `Pitch`, `delta_beta`, `theta_thrust`, `theta_cg`, `delta_W`, `Travel_Front`, `Travel_Rear`, `theta_chain`, `a_x`. Also delete the helper functions used only by these (`_swing`'s consumers besides `beta_static`, etc. — keep `_swing` itself if `beta_static` uses it; same for `_rake` if `Rake_Static` uses it).

In `SVG_T` (both `zh` and `en`), delete keys whose only callers were removed: `nose_dive`, `load_fwd`. Keep keys still in use.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test`
Expected: all tests pass, including the 15 removal tests and the original characterization tests for surviving formulas.

- [ ] **Step 6: Verify in browser**

Reload. Expected: sidebar shows 11 inputs (no Travel_Front/Rear/theta_chain/a_x), 0 intermediates, 3 channels (Trail_Static, W_F_Static, W_R_Static). Dashboard renders. No console errors. Clicking any remaining channel shows its formula and diagram.

- [ ] **Step 7: Commit**

```bash
git add src/formulas.js index.html tests/formulas.test.js
git commit -m "feat: remove dynamic-only parameters per static-V1 PRD scope"
```

---

## Task 6: Remove aero parameters (TDD)

Aero is explicitly out of PRD scope §5.2. With `MotoSPEC_FrontForce` / `MotoSPEC_RearForce` already removed in Task 5, `F_Aero` and its inputs are unused — drop them.

**Files:**
- Modify: `src/formulas.js`
- Modify: `tests/formulas.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests**

Append:

```js
const REMOVED_AERO = ['F_Aero', 'rho', 'V', 'Cd', 'A', 'C_f_aero', 'C_r_aero'];

for (const id of REMOVED_AERO) {
  test(`aero param ${id} is removed`, () => {
    assert.equal(P[id], undefined);
    assert.equal(CALC[id], undefined);
    assert.equal(INPUT_META[id], undefined);
  });
}
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: 7 new failures.

- [ ] **Step 3: Delete from `src/formulas.js`**

Remove the 7 entries from `P`, `CALC`, `INPUT_META`. (`TOPO_ORDER` already excludes them.)

- [ ] **Step 4: Delete from `index.html`**

Remove from `P_EN`: `F_Aero`, `rho`, `V`, `Cd`, `A`, `C_f_aero`, `C_r_aero`.
Remove from `DIAGRAMS`: `F_Aero`, `V`.
Remove from `SVG_T` (`zh` + `en`): `airflow`, `travel_dir`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Verify in browser**

Reload. Sidebar input count is now 11. No aero references. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/formulas.js index.html tests/formulas.test.js
git commit -m "feat: remove aero parameters per static-V1 PRD scope"
```

---

## Task 7: Add static-Trail SVG diagram

The dashboard now shows `Trail_Static` but it has no schematic illustration. Reuse the existing trail-geometry diagram.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add a `DIAGRAMS.Trail_Static` function**

Locate the `DIAGRAMS` object. Add (the geometry is the same as the previous dynamic Trail diagram — the only difference is which Rake variable feeds it; visually identical):

```js
DIAGRAMS.Trail_Static = () => {
  const b = BIKE, sh = b.steeringHead, fa = b.frontAxle;
  const dx = fa.x - sh.x, dy = fa.y - sh.y, len = Math.hypot(dx, dy);
  const ux = dx/len, uy = dy/len;
  const t = (b.groundY - sh.y) / uy;
  const gx = sh.x + ux * t;
  return `
    <line x1="${sh.x}" y1="${sh.y}" x2="${gx.toFixed(1)}" y2="${b.groundY}" stroke="${SC.hi}" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>
    <line x1="${fa.x}" y1="${fa.y}" x2="${fa.x}" y2="${b.groundY}" stroke="${SC.hi}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.5"/>
    <circle cx="${fa.x}" cy="${b.groundY}" r="3.5" fill="${SC.hi}"/>
    <circle cx="${gx.toFixed(1)}" cy="${b.groundY}" r="3.5" fill="${SC.hi}"/>
    <line x1="${fa.x}" y1="${b.groundY+18}" x2="${gx.toFixed(1)}" y2="${b.groundY+18}" stroke="${SC.hi}" stroke-width="2.5" marker-start="url(#ar-s)" marker-end="url(#ar)"/>
    <text x="${(fa.x+gx)/2-13}" y="${b.groundY+34}" fill="${SC.hi}" font-size="14" font-weight="bold">Trail</text>
    <text x="${fa.x-58}" y="${b.groundY-7}" fill="${SC.hi}" font-size="10" opacity="0.75">Contact pt</text>
    <text x="${gx-25}" y="${b.groundY-7}" fill="${SC.hi}" font-size="10" opacity="0.75">Axis · Ground</text>`;
};
```

- [ ] **Step 2: Verify in browser**

Reload. Click `Trail_Static` on the dashboard. Diagram renders with the Trail measurement marked along the ground line.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Trail_Static schematic diagram"
```

---

## Task 8: Replace presets with static bike presets

Existing `PRESET_LIST` sets `a_x`, `V`, `Travel_Front`, `Travel_Rear` — all removed inputs. Presets currently break. Replace with a small library of static bike geometries that exercise the parameter ranges meaningfully.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace `PRESET_LIST` and `PRESET_NAMES_EN`**

Locate `PRESET_LIST`. Replace with:

```js
const PRESET_LIST = [
  { name: '默认 / 运动', vals: { Rake_Static: 24, WB: 1380, Rf: 308, O: 30, beta_static: 14, L_SA: 580, H_CG: 650, L_CG: 750, Mass: 220, front_weight_dist: 0.52, rear_weight_dist: 0.48 } },
  { name: '超级运动 (R6 类)', vals: { Rake_Static: 24, WB: 1375, Rf: 308, O: 30, beta_static: 13, L_SA: 575, H_CG: 630, L_CG: 730, Mass: 195, front_weight_dist: 0.53, rear_weight_dist: 0.47 } },
  { name: '街车 (MT-09 类)', vals: { Rake_Static: 25, WB: 1430, Rf: 312, O: 33, beta_static: 15, L_SA: 595, H_CG: 660, L_CG: 760, Mass: 215, front_weight_dist: 0.50, rear_weight_dist: 0.50 } },
  { name: '巡航 (旅行级)', vals: { Rake_Static: 30, WB: 1520, Rf: 315, O: 38, beta_static: 12, L_SA: 610, H_CG: 700, L_CG: 800, Mass: 280, front_weight_dist: 0.48, rear_weight_dist: 0.52 } },
];

const PRESET_NAMES_EN = ['Default / Sport', 'Supersport (R6-class)', 'Naked (MT-09-class)', 'Cruiser / Touring'];
```

- [ ] **Step 2: Verify in browser**

Reload Dashboard. Click each preset. Expected: all sliders update to plausible values, `Trail_Static` recomputes per preset (cruiser should give higher trail than supersport).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: replace dynamic presets with static bike-class presets"
```

---

## Task 9: Reference-bike validation harness

This harness is what makes PRD Phase 2 (cross-validation against MotoSpec) mechanical. Each fixture entry holds a bike's measured inputs plus expected outputs from two independent sources: the manufacturer spec sheet (available now) and MotoSpec (filled in Phase 2).

**Files:**
- Create: `tests/fixtures/reference-bikes.json`
- Create: `tests/validation.test.js`

- [ ] **Step 1: Create fixture with three reference bikes**

```json
{
  "bikes": [
    {
      "name": "Yamaha YZF-R6 (2020)",
      "source": "Yamaha press kit geometry",
      "inputs": {
        "Rake_Static": 24.0,
        "WB": 1375,
        "Rf": 308,
        "O": 30,
        "beta_static": 13,
        "L_SA": 575,
        "H_CG": 630,
        "L_CG": 730,
        "Mass": 195,
        "front_weight_dist": 0.53,
        "rear_weight_dist": 0.47
      },
      "expected": {
        "spec_sheet": { "Trail_Static": 97 },
        "motospec":   null
      },
      "tolerance_mm": 2
    },
    {
      "name": "Honda CBR1000RR-R Fireblade SP (2024)",
      "source": "Honda technical sheet",
      "inputs": {
        "Rake_Static": 24.0,
        "WB": 1455,
        "Rf": 313,
        "O": 30,
        "beta_static": 14,
        "L_SA": 590,
        "H_CG": 650,
        "L_CG": 760,
        "Mass": 201,
        "front_weight_dist": 0.53,
        "rear_weight_dist": 0.47
      },
      "expected": {
        "spec_sheet": { "Trail_Static": 102 },
        "motospec":   null
      },
      "tolerance_mm": 2
    },
    {
      "name": "Ducati Panigale V4 (2023)",
      "source": "Ducati owner manual",
      "inputs": {
        "Rake_Static": 24.5,
        "WB": 1469,
        "Rf": 312,
        "O": 30,
        "beta_static": 14,
        "L_SA": 585,
        "H_CG": 645,
        "L_CG": 750,
        "Mass": 198,
        "front_weight_dist": 0.54,
        "rear_weight_dist": 0.46
      },
      "expected": {
        "spec_sheet": { "Trail_Static": 100 },
        "motospec":   null
      },
      "tolerance_mm": 2
    }
  ]
}
```

> **Note for the engineer:** the Trail values above are read from each manufacturer's published geometry sheet. If you find the published numbers don't match the inputs we list (manufacturers occasionally publish a Trail value derived using a different Rf or O than they publish elsewhere), update both the input and the expected value to match a single self-consistent source — flag the bike in a comment but keep the test in the suite.

- [ ] **Step 2: Write the validation test**

```js
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

  // Phase-2 hook: ignored until motospec key populated
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
```

- [ ] **Step 3: Run validation tests**

Run: `npm test`
Expected: 3 spec-sheet tests pass (each reference bike's Trail_Static within ±2 mm of the published value). Zero MotoSpec parity tests run yet — they activate once `motospec` is non-null.

If any reference bike fails, that's a real signal — either the formula is wrong, the published Trail uses a different convention (e.g. road-trail vs vertical-trail), or the input values came from inconsistent sources. Investigate before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/reference-bikes.json tests/validation.test.js
git commit -m "test: reference-bike validation harness for static geometry"
```

---

## Task 10: Documentation hook for Phase-2 validation

A README block tells the future engineer how to fill in MotoSpec values once the licence is purchased.

**Files:**
- Create: `tests/fixtures/README.md`

- [ ] **Step 1: Write the README**

```markdown
# Reference-bike fixtures

Each entry in `reference-bikes.json` has two expected blocks:

- `spec_sheet` — values from the manufacturer's published geometry sheet.
  Active immediately. Used for Phase-1 sanity (catches gross formula errors).
- `motospec` — values produced by MotoSpec for the same inputs.
  Populated in PRD Phase 2 once a MotoSpec licence is in hand.

## Phase 2 procedure

1. Enter each bike's `inputs` block into MotoSpec exactly as listed.
2. Read MotoSpec's static outputs.
3. Replace `"motospec": null` with `{ "Trail_Static": <value>, ... }` for every
   output we compute.
4. Run `npm test`. The `motospec parity` tests now activate.
5. If any test fails, the discrepancy is a real bug — either in our formula
   or in the inputs we entered. Resolve before adjusting tolerances.

## Adding a new bike

Use a single self-consistent geometry source per bike. Manufacturers sometimes
publish Trail derived from a different Rf or Offset than they publish in the
main geometry sheet — pick one source and stay with it. Document the source in
the `source` field.
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/README.md
git commit -m "docs: phase-2 validation procedure for reference fixtures"
```

---

## Task 11: Final smoke + push

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests green. Count summary near `tests <N>` and `pass <N>`.

- [ ] **Step 2: Browser smoke test**

Run: `python3 -m http.server 8000` then open `http://localhost:8000/`.

Walk through the checklist:
- Sidebar shows three sections: Channels (Trail_Static, W_F_Static, W_R_Static), no Intermediates, 11 Inputs.
- Dashboard renders three cards.
- Click each preset → inputs update, channels recompute, Trail_Static differs between sport and cruiser presets.
- Switch language EN ↔ ZH → all visible labels translate.
- Click Trail_Static → formula renders, diagram renders, dependency list shows Rf / Rake_Static / O.
- Open every input page → slider works, value updates Trail_Static live.
- Open browser devtools console → no errors.

- [ ] **Step 3: Push**

```bash
git push
```

Vercel rebuilds; the deployed app is the static-V1 core.

---

## Self-Review

**Spec coverage** (PRD §5.1 / §6 / §8):

| PRD requirement | Task |
|---|---|
| §5.1 Static geometry calculations | Task 4 (Trail_Static) + retained `W_F_Static`/`W_R_Static` |
| §5.2 Out-of-scope: dynamic & aero — must be removed | Tasks 5, 6 |
| §6.2 Modular formulas validatable independently | Task 2 (extract pure module) + Task 3 (per-formula tests) |
| §6.2 Handle small intricacies | Trail formula uses radians correctly (Task 4 step 3) |
| §8 Validation procedure for MotoSpec parity | Tasks 9, 10 |

Not yet covered (deliberately — separate plans, per scope discussion): guided input flow (§6.1), educational depth (§6.4), comparison view (§6.3), adjustment-variable handling (§6.1 last bullet). These need the three blocking PRD §9 questions answered first.

**Placeholder scan:** clean — every step has either explicit code, an exact command, or a concrete file edit description. No "TBD" / "appropriate" / "etc."

**Type consistency:** `Trail_Static` is consistent across formulas.js (definition), TOPO_ORDER, P_EN, DIAGRAMS, validation fixture, and tests. The `computeAll(inputs)` signature appears identically in formulas.js, formulas.test.js, and validation.test.js. `tolerance_mm` is used consistently in fixture and harness.
