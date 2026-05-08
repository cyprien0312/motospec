# Chassis Setup Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "🏗 Chassis Setup" page where users enter (or pick from a catalog) the static frame geometry, mass + CG, aero share, and tire of a specific bike — the chassis-side counterpart to the existing Linkage Setup page. Chassis profiles are saved into a new catalog and can be selected per-bike from the Data Table, just like the existing fork / shock / swingarm / linkage / clamp catalogs.

**Architecture:**
- New module `src/chassis-setup.js` mirrors `src/linkage-setup.js` (renderer + diagram + input cards + live readouts).
- New catalog key `chassis` extends `data/chassis.json` + the catalog overlay system in `src/catalog.js`.
- Field rationalization: merge the duplicate `L_SA` and `Swingarm_Length` inputs into a single canonical `Swingarm_Length`. `beta_static` stays a single name; chassis page becomes its canonical owner; Linkage Setup reads it.
- Data Table gains a `chassis` component cell on every bike row; `materializeBikeInputs` flattens the chosen chassis profile's specs into the bike's input dict alongside fork / shock / swingarm / linkage / clamp.
- The current Yamaha R7 / Suzuki GSX-8R / Aprilia RS 660 mockup data in `src/reference-bikes.js` is replaced with neutral blank columns until real data is sourced (the mockup numbers are not accurate enough to pin tests against).

**Tech Stack:** Plain ES modules, no bundler. Node 22+ built-in test runner. SVG diagram is hand-authored vector traced from a generic naked-sport side-view, scaled to fit the bike's `WB` and tire `Rf`.

**Phasing:** 4 phases (independently shippable):
- **Phase A — Field merge** (rename `L_SA` → `Swingarm_Length` everywhere; one canonical channel)
- **Phase B — Chassis catalog** (`data/chassis.json`, catalog wiring, `materializeBikeInputs` extension)
- **Phase C — Chassis Setup page** (renderer, diagram, input cards, live readouts, save-as-profile flow)
- **Phase D — Data Table integration + mockup removal** (per-bike `chassis` selector, blank baseline, formula fixture cleanup)

---

## File Structure

**New files:**
- `src/chassis-setup.js` — `renderChassisSetup({ values, lang })` + SVG diagram + input cards + live readouts.
- `data/chassis.json` — baseline chassis catalog (starts empty `{}`; populated as real specs are sourced).
- `tests/chassis-setup.test.js` — schema + render + readout assertions.
- `tests/chassis-catalog.test.js` — catalog round-trip + `materializeBikeInputs` chassis flatten test.
- `docs/research/chassis-coords.md` — sourcing notes for OEM frame geometry / CG / Mass per bike (parallels `docs/research/linkage-coords.md`).

**Modified:**
- `src/formulas.js` — drop `L_SA` from `P` registry + `INPUT_META` + `CALC` + `defaultValues`; rewrite `delta_beta` and any other `L_SA` consumer to use `Swingarm_Length`.
- `src/linkage.js` — no functional change; verify nothing imports `L_SA`.
- `src/linkage-setup.js` — `beta_static` and `Swingarm_Length` inputs may be hidden here in favor of chassis page (decision deferred to Phase C step).
- `src/catalog.js` — add `'chassis'` to `CATALOG_KEYS`; extend `materializeBikeInputs` to flatten the selected chassis entry's `specs` into the bike's input dict.
- `src/data-table.js` — add `chassis` to `COMPONENT_TO_CATALOG`; add a `Chassis` row in `FRAME GEOMETRY` rendering as a catalog `<select>`; remove the per-row weight-distribution / aero-share inputs once they live on the chassis profile (replace with read-only echo of the chosen chassis).
- `src/reference-bikes.js` — replace the three R7 / GSX-8R / RS 660 entries' `inputs` blocks with empty/blank defaults; the bike `name` becomes `'Bike 1' / 'Bike 2' / 'Bike 3'` (or empty); `expected.motospec` blocks emptied so `tests/validation.test.js` skips bikes without expected values.
- `tests/fixtures/reference-bikes.json` — synced with `src/reference-bikes.js` (mockup blocks emptied; `expected` blocks cleared to `{}`).
- `index.html` — sidebar nav button (`🏗 Chassis Setup` / `🏗 底盘设置`); import + route case for `__chassis`; bilingual UI strings; window-exposure for new handlers (`setChassisInput`, `saveChassisAsPreset`, `loadChassisFromLibrary`, `setChassisProfile`).
- `CLAUDE.md` — add `src/chassis-setup.js` and `data/chassis.json` to the module-layout section; note the L_SA→Swingarm_Length merge and the chassis catalog.

---

# Phase A — Merge `L_SA` into `Swingarm_Length`

Goal: one canonical name for the swingarm-length input. `Swingarm_Length` wins because it is already the field used by `linkage.js`, `linkage-setup.js`, and the Linkage Setup UI; `L_SA` is only used inside `formulas.js`.

## Task A1: Rewire `delta_beta` to use `Swingarm_Length`

**Files:** `src/formulas.js`

- [ ] **Step 1: Read current state**

  Run: `grep -n "L_SA" src/formulas.js`
  Confirm the only consumers are `delta_beta` (line ~412) and the `theta_thrust` formula prose (line 104) and the `L_SA` registry/INPUT_META entries.

- [ ] **Step 2: Update `delta_beta`**

  In `CALC.delta_beta`, replace `v.L_SA` with `v.Swingarm_Length`. Update the `P.delta_beta.deps` array to `['Travel_Rear', 'Swingarm_Length']` and the formula prose to reference `Swingarm_Length`.

- [ ] **Step 3: Update `theta_thrust` formula prose**

  Replace the `{ref:'L_SA'}` token in `P.theta_thrust.formula` with `{ref:'Swingarm_Length'}` for any reference. (`P.theta_thrust.deps` already includes `Swingarm_Length`, no change there.)

- [ ] **Step 4: Drop `L_SA` from registry**

  Delete `P.L_SA`, `INPUT_META.L_SA`, and any `TOPO_ORDER` reference. Run the test suite — failures will name the next consumer.

- [ ] **Step 5: Run tests**

```bash
npm test
```

  Expected: every reference to `L_SA` is gone; the topology stays valid.

- [ ] **Step 6: Commit**

```bash
git commit -am "formulas: merge L_SA into Swingarm_Length (one canonical input)"
```

## Task A2: Sweep tests + reference-bikes for `L_SA`

**Files:** `tests/*.js`, `src/reference-bikes.js`, `tests/fixtures/reference-bikes.json`

- [ ] **Step 1: Find remaining hits**

  `grep -rn "L_SA" src/ tests/ data/`

- [ ] **Step 2: For each bike entry, replace `L_SA: 580` with `Swingarm_Length: 580`** (if both already exist on the same bike, drop `L_SA`).

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git commit -am "fixtures: drop legacy L_SA in favor of Swingarm_Length"
```

---

# Phase B — Chassis catalog

Goal: introduce a `chassis` catalog mirror of forks/shocks/etc., so chassis specs round-trip through localStorage overlay and are flattened into a bike's inputs by `materializeBikeInputs`.

## Task B1: Define the chassis profile schema

**Files:** `data/chassis.json` (new), `src/catalog.js`

- [ ] **Step 1: Decide canonical chassis fields**

  The chassis profile carries:
  - Frame geometry: `Rake_Static`, `WB`, `Swingarm_Length`, `beta_static`, `Yoke_Offset`, `Fork_Position`
  - Mass + CG: `Mass`, `H_CG`, `L_CG`, `front_weight_dist` (and `rear_weight_dist = 1 − front_weight_dist`)
  - Aero share: `C_f_aero`, `C_r_aero` (sum to 1; either can be the source of truth)
  - Tire: `Rf` (front rolling radius)

  Each entry has shape:
  ```json
  {
    "name": "Yamaha YZF-R7 (2022) — stock chassis",
    "source": "service manual page X / measurement",
    "specs": { "Rake_Static": 23.5, "WB": 1395, "Swingarm_Length": 580, ... }
  }
  ```

- [ ] **Step 2: Create `data/chassis.json`**

  Start empty: `{}`. The user populates it via the page's "Save as Profile" button or by hand-editing later. Real OEM data is a separate research task tracked in `docs/research/chassis-coords.md`.

- [ ] **Step 3: Wire into `src/catalog.js`**

  Add `'chassis'` to `CATALOG_KEYS`. Add the JSON import at the top: `import baselineChassis from '../data/chassis.json' with { type: 'json' };`. Extend the baseline merge to include chassis. Verify `getUserOverlay` / `applyUserOverlay` / `resetUserOverlay` round-trip through chassis without code change (they iterate `CATALOG_KEYS`).

- [ ] **Step 4: Extend `materializeBikeInputs`**

  When a bike has `components.chassis = "<id>"`, look up the chassis entry and shallow-merge its `specs` into the input dict. Order of precedence: `COMMON_ENV` → chassis specs → fork/shock/swingarm/linkage/clamp specs → bike's per-row overrides. (The bike's per-row inputs always win; the chassis profile is a baseline.)

- [ ] **Step 5: Test**

  Add `tests/chassis-catalog.test.js`:
  - Catalog round-trip (`setCatalogEntry('chassis', id, entry)` → `CATALOGS.chassis[id]` reflects it).
  - `materializeBikeInputs` flattens chassis specs into the bike's inputs.
  - User overlay persists through `getUserOverlay` / `applyUserOverlay`.

```bash
npm test -- --test-name-pattern='chassis'
```

- [ ] **Step 6: Commit**

```bash
git commit -am "catalog: add chassis catalog (forks/shocks/… get a chassis sibling)"
```

---

# Phase C — Chassis Setup page

Goal: a dedicated page where the user enters or measures the chassis fields, sees a live diagram, and can save the profile to the chassis catalog (or load one from it).

## Task C1: Render skeleton + input cards

**Files:** `src/chassis-setup.js` (new), `index.html`

- [ ] **Step 1: Create `src/chassis-setup.js`**

  Export `renderChassisSetup({ values, lang })`. Mirrors the structure of `renderLinkageSetup`:
  - Top: live-readout strip (`Trail_Static`, `W_F_Static`, `W_R_Static`, total weight check `front_weight_dist + rear_weight_dist`).
  - Middle: SVG diagram (Task C3).
  - Bottom: input cards grouped by section.

- [ ] **Step 2: Define the field groups**

  ```js
  export const CHASSIS_GROUPS = [
    { key: 'geometry', label_zh: '车架几何', label_en: 'Frame Geometry',
      fields: ['Rake_Static', 'WB', 'Swingarm_Length', 'beta_static', 'Yoke_Offset', 'Fork_Position'] },
    { key: 'mass_cg',  label_zh: '质量与重心', label_en: 'Mass & CG',
      fields: ['Mass', 'H_CG', 'L_CG', 'front_weight_dist'] },
    { key: 'aero',     label_zh: '气动分配', label_en: 'Aero Share',
      fields: ['C_f_aero'] },
    { key: 'tire',     label_zh: '轮胎', label_en: 'Tire',
      fields: ['Rf'] },
  ];
  ```

  `front_weight_dist` and `C_f_aero` get linked-pair logic (when one changes, the other becomes 1 − value).

- [ ] **Step 3: Render input cards**

  Each field renders as a numeric input bound to `setChassisInput(fieldKey, value)`. Card label = `P[fieldKey].label` (zh) or `P_EN[fieldKey].label` (en); description from `P[fieldKey].desc` or `P_EN[fieldKey].desc`.

- [ ] **Step 4: Wire into `index.html`**

  Add nav button (`🏗 Chassis Setup` / `🏗 底盘设置`), import `renderChassisSetup`, add route `__chassis` in `navigateTo` / `navigateRoot` / `renderContent` / breadcrumb / `renderNav`. Update `state` if needed (no new persistent state — chassis fields live in `state.values`).

- [ ] **Step 5: `setChassisInput` handler**

  Same pattern as `setInputValue`, plus:
  - When `front_weight_dist` changes, set `rear_weight_dist = 1 − v` (clamped, 3 decimals).
  - When `C_f_aero` changes, set `C_r_aero = 1 − v`.
  - Calls `saveState()` and `patchChassisView()` (a scoped DOM swap of just the diagram, readouts, and the changed input — preserves focus).

- [ ] **Step 6: Test**

  `tests/chassis-setup.test.js`:
  - Render contains every field's input.
  - `setChassisInput('front_weight_dist', 0.55)` mirrors `rear_weight_dist = 0.45`.
  - Live readouts include `Trail_Static`, `W_F_Static`, `W_R_Static`.

- [ ] **Step 7: Commit**

```bash
git commit -am "chassis-setup: skeleton page with input cards + linked weight/aero pairs"
```

## Task C2: Live readouts strip

**Files:** `src/chassis-setup.js`

- [ ] **Step 1: Compute readouts**

  Reuse `computeAll(values)`; surface `Trail_Static`, `W_F_Static`, `W_R_Static`, plus a derived sanity readout: `Σ Aero = ${(C_f_aero + C_r_aero).toFixed(2)}` (should be 1.00).

- [ ] **Step 2: Render the strip**

  Mirror `linkage-readout` styling — same CSS class so it visually matches the linkage page.

- [ ] **Step 3: Commit**

```bash
git commit -am "chassis-setup: live readouts (Trail_Static, W_F_Static, W_R_Static)"
```

## Task C3: Side-view SVG diagram

**Files:** `src/chassis-setup.js`

- [ ] **Step 1: Source a reference outline**

  Trace a generic naked-sport side-view (frame triangle, fork, swingarm, both wheels with rim + spokes, seat, fairing). Store as a parameterized SVG path that scales by `WB` (axle-to-axle horizontal) and `Rf` (wheel radius). Other reference points (CG dot, steering axis line, swingarm pivot dot, axle dots) are computed from the fields.

  The trace should be detailed enough to read as a real motorcycle, not a stick figure — fork tubes have width, frame has visible top tube and downtube, swingarm has a tapered profile, wheel has spokes (5–6 stylized), tire has visible thickness. Single-color line work, no fills (matches the existing dark theme).

- [ ] **Step 2: Compute overlay annotations**

  Lines + labels for every chassis field with a geometric meaning:
  - `WB`: horizontal arrow between axle centers.
  - `Rake_Static`: angled line through the steering head; arc + label for the angle from vertical.
  - `Swingarm_Length`: line from swingarm pivot to rear axle.
  - `beta_static`: arc + label between swingarm and horizontal.
  - `Yoke_Offset`: short perpendicular from steering axis to front axle line.
  - `Fork_Position`: tick along the fork tube above the lower clamp.
  - `H_CG`: vertical line from ground to CG dot.
  - `L_CG`: horizontal line from rear axle to CG.
  - `front_weight_dist` / `rear_weight_dist`: bar chart at the bottom showing the split.
  - `Rf`: radius callout on the front wheel.

- [ ] **Step 3: Auto-fit the viewport**

  Compute the bounding box of all annotated points + the bike outline; fit to the SVG with padding so changes in `WB` or `H_CG` always render at sensible scale.

- [ ] **Step 4: Test**

  Render-with-defaults snapshot test: SVG contains every expected `data-anno="<field>"` group.

- [ ] **Step 5: Commit**

```bash
git commit -am "chassis-setup: traced side-view diagram with annotated fields"
```

## Task C4: Save / load chassis profile

**Files:** `src/chassis-setup.js`, `index.html`

- [ ] **Step 1: "Save as Profile" button**

  Below the input cards. On click, prompts for a name (`prompt()` is fine for v1), then calls `setCatalogEntry('chassis', slugify(name), { name, specs: pickChassisFields(values) })`. Mirror `buildLinkagePresetEntry` from `linkage-setup.js`.

- [ ] **Step 2: "Load from Library" `<select>`**

  Dropdown of existing chassis catalog entries. On change, copy the chosen entry's `specs` into `state.values` (only the chassis fields; everything else stays put).

- [ ] **Step 3: Window exposure**

  Add `saveChassisAsPreset` and `loadChassisFromLibrary` to the `Object.assign(window, …)` line in `index.html`.

- [ ] **Step 4: Test**

  - Save path: `setChassisInput`s + click save → catalog entry exists with the right specs.
  - Load path: load a known entry → `state.values` reflects every spec field.

- [ ] **Step 5: Commit**

```bash
git commit -am "chassis-setup: save-as-profile / load-from-library round-trip"
```

---

# Phase D — Data Table integration + mockup data removal

Goal: Data Table picks chassis profiles per-bike like it picks forks. The current inaccurate Yamaha R7 / Suzuki GSX-8R / Aprilia RS 660 mockup is removed so users start from a clean, neutral state.

## Task D1: Add `chassis` component cell to Data Table

**Files:** `src/data-table.js`, `src/catalog.js`

- [ ] **Step 1: Extend `COMPONENT_TO_CATALOG`**

  Add `chassis: 'chassis'` so Data Table component-cell rendering and `setBikeComponent('chassis', id)` round-trip into the chassis catalog.

- [ ] **Step 2: Add a Chassis row in `FRAME GEOMETRY`**

  At the top of the `FRAME GEOMETRY` group, insert a `Chassis` row with `component: 'chassis'`. The dropdown lets you pick a chassis profile; when picked, the bike's input dict resolves chassis fields from the chosen profile via `materializeBikeInputs`.

- [ ] **Step 3: Decide what stays editable per-row**

  Once a bike has a chassis profile, the per-row weight-distribution + aero-share + frame-intrinsic inputs are all sourced from the chassis. Two options:
  - **(a)** Keep them as editable rows that override the chassis (the per-row override pattern that already exists today).
  - **(b)** Make them read-only echoes of the chosen chassis to enforce "edit on the Chassis Setup page."

  Recommend **(a)** for symmetry with how forks / shocks already work — a bike can override any spec from its component profile by typing into the row.

- [ ] **Step 4: Test**

  Update `tests/data-table.test.js`:
  - Component select for `chassis` exists.
  - Default bikes carry `components.chassis` (or null, if no profile is chosen by default).

- [ ] **Step 5: Commit**

```bash
git commit -am "data-table: per-bike chassis selector wired through materializeBikeInputs"
```

## Task D2: Remove the mockup R7 / GSX-8R / RS 660 data

**Files:** `src/reference-bikes.js`, `tests/fixtures/reference-bikes.json`, `tests/validation.test.js`, `tests/data-table.test.js`, `tests/formulas.test.js`

- [ ] **Step 1: Audit the mockup**

  `grep -n "Yamaha R7\|GSX-8R\|RS 660\|RS660" src/ tests/`. Note every test that pins specific numbers (`val.tolerance_mm`, `expected.MotoSPEC_*`) against these bikes.

- [ ] **Step 2: Replace with neutral entries**

  In `src/reference-bikes.js`, replace the three bike entries with placeholders:
  ```js
  export const REFERENCE_BIKES = [
    { id: 'bike-a', name: 'Bike A', inputs: {}, components: {}, dynamic_presets: {}, expected: {} },
    { id: 'bike-b', name: 'Bike B', inputs: {}, components: {}, dynamic_presets: {}, expected: {} },
    { id: 'bike-c', name: 'Bike C', inputs: {}, components: {}, dynamic_presets: {}, expected: {} },
  ];
  ```

  Keep `COMMON_ENV` untouched.

- [ ] **Step 3: Sync `tests/fixtures/reference-bikes.json`**

  Mirror `src/reference-bikes.js`. `expected` blocks become `{}` so `tests/validation.test.js` skips bikes without expected values.

- [ ] **Step 4: Update `tests/validation.test.js`**

  If the harness currently asserts every bike has populated `expected`, change it to: "for bikes whose `expected` is non-empty, diff `computeAll` against `expected` within `tolerance_mm`." Bikes with empty `expected` are reported as "skipped — no spec sheet."

- [ ] **Step 5: Update bike-name assertions**

  `tests/data-table.test.js` line that asserts `'Yamaha R7'`, `'Suzuki GSX-8R'`, `'Aprilia RS 660'` becomes `'Bike A'`, `'Bike B'`, `'Bike C'` — or drop the name assertion entirely (names are user-editable inputs).

- [ ] **Step 6: Update `tests/formulas.test.js` and `tests/reference-bikes.test.js`**

  Drop any test that asserted specific numeric values against the R7 / GSX-8R / RS 660 mockup. Phase C of the data-table-full-parity plan (real linkage coords) becomes the gating task for these tests' return — gated by real chassis + linkage data, sourced via `docs/research/`.

- [ ] **Step 7: Test**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git commit -am "reference-bikes: replace inaccurate R7/GSX-8R/RS660 mockup with neutral placeholders"
```

## Task D3: Refresh CLAUDE.md + plan docs

**Files:** `CLAUDE.md`, `docs/superpowers/plans/2026-05-06-data-table-full-parity.md`

- [ ] **Step 1: CLAUDE.md updates**

  - Add a `src/chassis-setup.js` line under "Module layout."
  - Add `data/chassis.json` to the `data/*.json` line.
  - Update the `src/data-table.js` line: chassis is now one of the catalog keys; add `chassis` to the list of five → six.
  - Update the `src/catalog.js` line for the same reason.
  - Note the L_SA → Swingarm_Length merge.

- [ ] **Step 2: Update `2026-05-06-data-table-full-parity.md` Phase C status**

  Phase C's "Source real linkage coordinates" task is unchanged but now sits next to a parallel "Source real chassis coordinates" task tracked in `docs/research/chassis-coords.md`. Add a one-line cross-reference; do not duplicate the content.

- [ ] **Step 3: Commit**

```bash
git commit -am "docs: chassis catalog + L_SA merge in CLAUDE.md and plan cross-refs"
```

---

## Verification checklist (before shipping)

- [ ] `npm test` is green.
- [ ] Linkage Setup page still works (uses `Swingarm_Length` and `beta_static` as before; no L_SA references).
- [ ] Chassis Setup page renders, all input cards respond, `front_weight_dist` and `C_f_aero` mirror their pairs.
- [ ] Save-as-profile writes to localStorage overlay; reload → profile is in the dropdown.
- [ ] Data Table's `Chassis` dropdown reflects user-saved profiles + baseline (currently empty).
- [ ] Selecting a chassis profile in the Data Table updates the per-bike inputs visibly.
- [ ] Default `state` has empty `Bike A/B/C` columns — no R7 / GSX-8R / RS 660 numbers anywhere except git history.
- [ ] No diagnostics on `import` lines (the JSON-import-attribute warnings stay since `jsconfig.json` is unchanged).

---

## Open decisions to resolve during implementation

1. **`Yoke_Offset` placement.** Currently treated as a chassis input; arguably a clamp-catalog spec. If the user already has it in `data/clamps.json` per clamp, the chassis page should pull from the chosen clamp instead. Default for Phase C: keep on the chassis page; revisit once the chassis profile flow is solid.
2. **`Fork_Position` placement.** Same question — fork-side or chassis-side? It is a *setup* number (ride-height adjustment) more than a chassis spec. Tentatively on the chassis page as a "setup" subgroup; can be moved later.
3. **Diagram fidelity vs accuracy.** A traced naked-sport side-view will look beautiful at default values but stretch awkwardly when WB / H_CG are far from naked-sport norms (e.g., a cruiser). For v1, accept the stretch; in v2 consider three or four bike-archetype outlines (sport, naked, adv, cruiser) and pick by aspect ratio.
