# Data Table (Advance) — Design Spec

**Date:** 2026-05-07
**Status:** Draft, awaiting user review

## Goal

Add a new top-level page **"Data Table (Advance)"** (zh: **数据表（高级）**) that displays the same 14 RESULTS rows as the existing data table, but with a strict invariant: **every displayed value is the output of a real physics calculation against real inputs, or the cell is blank.** No mock data, no hidden defaults, no placeholder linkage coords, no static-input echo dressed up as a computed result.

The existing data table is left untouched — its `pending` / `coords` / `static` / `partial` / `approx` badges remain a useful "what's not yet wired" view. The advance page is the contract for "this number is real".

**v1 scope:** static at-rest values only (load case effectively `a_x = 0`, `V = 0`, `Travel_Front = 0`, `Travel_Rear = 0`, `Lean_Angle = 0`). Dynamic load-case wiring is deferred to a later phase.

## Non-goals (v1)

- New result rows beyond the existing 14.
- Dynamic load-case influence on results.
- Preset selector (sag / braking / mid-corner) — meaningless when v1 is at-rest.
- Editing or replacing the existing data table page.
- New build tooling, new bundler, new dependency.

## Architecture

### Page & navigation

- New top-level page sibling to the existing Data Table tab. Default landing remains the existing page.
- Lang toggle and `state.lang` reused.
- Page key: `'data-table-advance'`. Added to the page switch in `renderContent()`.

### File layout

**New files:**
- `src/data-table-advance.js` — `ADVANCE_ROW_GROUPS`, `defaultAdvanceBikes()`, `renderDataTableAdvance()`, helpers (`leafDepsFor(resultName)`, `isPlaceholderCoords(inputs)`, `validateInputs(inputs, requiredLeaves)`).
- `tests/data-table-advance.test.js` — covers behavioral invariants below.

**Edits to existing files:**
- `src/formulas.js` — implement `Front_Wheel_Rate` and `Rear_Wheel_Rate` in `CALC` (replacing `() => NaN`). `TOPO_ORDER` already lists them.
- `src/data-table.js` — export the genuinely shared bits used by the advance module (`COMPONENT_TO_CATALOG`, `fmtNum`, `escapeHtml`, `catalogEntriesFor`).
- `index.html` — nav button, import, page-switch case, `window` re-exposure for any new inline handlers, one new CSS rule (`.dt-missing`) and a per-row count chip style.
- `tests/fixtures/reference-bikes.json` — add expected `Front_Wheel_Rate` and `Rear_Wheel_Rate` per bike.

### State shape

The advance page stores its bikes under `state.advanceBikes`, separate from any state used by the existing data table. Editing a value on one page does not affect the other. This avoids surprising users when switching pages and keeps the two pages independently auditable.

## Rows on the advance page

### Result rows (14, identical order to current data table RESULTS)

| # | Result | Source / formula at static |
|---|--------|----------------------------|
| 1 | Rake (deg) | `MotoSPEC_Rake` — at static (Travel=0) equals `Rake_Static` |
| 2 | Ground Trail (mm) | `MotoSPEC_Trail` from `Rf`, `Rake_Static`, `O` |
| 3 | Rear Wheel Vertical Travel (mm) | `Rear_Wheel_Vertical_Travel` — needs real linkage coords |
| 4 | Rear Ride Height Reference (mm) | `Rear_Ride_Height` — needs real linkage coords |
| 5 | Swingarm Angle (deg) | `MotoSPEC_SwgarmAngl` — β at static sag, needs real linkage coords |
| 6 | AntiSquat (%) | `MotoSPEC_AntSquat` — needs real linkage coords + `H_CG`, `L_CG`, sprockets, swingarm length |
| 7 | Progression (%) | `Progression` — needs real linkage coords |
| 8 | Motion Ratio (wheel/shock) | `Motion_Ratio` — needs real linkage coords |
| 9 | Wheelbase (mm) | `WB` input |
| 10 | Front Wheel Rate (N/mm) | **new formula** (see below) |
| 11 | Rear Wheel Rate (N/mm) | **new formula** (see below) |
| 12 | Front Wheel Force (N) | At static: `W_F_Static = Mass · g · front_weight_dist` |
| 13 | Rear Wheel Force (N) | At static: `W_R_Static = Mass · g · rear_weight_dist` |
| 14 | CofG % Front / % Rear | `front_weight_dist × 100`, `(1 − front_weight_dist) × 100` |

### Input rows kept

Determined programmatically: the union of leaf inputs reached by walking `P[result].deps` transitively for the 14 results. Hand-picked preview:

- **BIKE:** Mass, CofG Height (`H_CG`), Front Weight Dist (`front_weight_dist`), Rake_Static, Offset (`O`), Wheelbase (`WB`)
- **FRONT:** Front Tire Radius (`Rf`), Front Spring Rate (`Front_Spring_Rate`)
- **REAR:** Rear Tire Radius, Rear Spring Rate (`Rear_Spring_Rate`), Swingarm Length, shock fields needed for linkage closure
- **SPROCKETS:** Front Sprocket, Rear Sprocket
- **LINKAGE COORDS:** provided by the selected catalog `linkages` entry — not editable per-cell on this page
- **COMPONENTS:** clamp / fork / shock / swingarm / linkage selectors (catalog dropdowns)

### Input rows dropped

Any input not transitively required by the 14 v1 results is omitted from the advance page:

- Fork Position, Front Spring Preload, Front Oil Level, Front Topout Rate, Front Topout Length
- Shock Length (input — actual shock length is solved by linkage closure), Rear Spring Preload, Rear Topout Rate, Rear Topout Length
- Travel_Front, Travel_Rear, Lean_Angle (load-case — deferred to dynamic phase)
- DYNAMIC LOAD group entirely (`a_x`, `V`, `Cd`, `A`, `C_f_aero`, `C_r_aero`)
- Preset selector (sag / braking / mid-corner)

## New formulas (the only formula work in v1)

Both formulas use displacement-at-spring-per-unit-wheel-displacement so the energy identity `K_wheel · x_wheel² = K_spring · x_spring²` holds in both directions. Existing `Motion_Ratio` is defined as **wheel/shock** (≈ 2–3 typical), which is the inverse of shock-per-wheel — hence the rear formula divides.

```js
// MR_front: fork compression per unit vertical front-wheel travel
//   = 1 / cos(rake_static); typically 1.05–1.10 for sportbikes
const MR_front = 1 / Math.cos(Rake_Static * D2R);
Front_Wheel_Rate = Front_Spring_Rate / (MR_front * MR_front);

// Existing Motion_Ratio is wheel/shock (≈2–3). The energy identity gives
//   K_wheel = K_spring · (x_spring / x_wheel)²
//          = K_spring · (1 / Motion_Ratio)²
Rear_Wheel_Rate = Rear_Spring_Rate / (Motion_Ratio * Motion_Ratio);
```

Sanity check (typical sportbike): shock spring 90 N/mm, MR = 2.7 → wheel rate ≈ 12.3 N/mm.

These formulas are added to `src/formulas.js` (replacing the `() => NaN` stubs), so the existing data table also picks them up — legitimately upgrading two of its `pending` rows to real values.

## Data flow & "no mocks" enforcement

Per-bike pipeline on the advance page:

1. Start with `defaultBikes()` but **strip the load-case preset** (no `PRESET_VALUES` injection).
2. Compute `inputs = materializeBikeInputs(bike)` — pulls catalog entries (forks/shocks/swingarms/linkages/clamps) into a flat input dict.
3. Force `Travel_Front = 0`, `Travel_Rear = 0`, `Lean_Angle = 0`, `a_x = 0`, `V = 0`.
4. **Validate before computing.** For each of the 14 results, walk `P[result].deps` transitively to its leaf inputs. If any leaf is `undefined`, `NaN`, or matches a placeholder sentinel (linkage placeholder coords from `LINKAGE_PLACEHOLDER_LINKED` / `LINKAGE_PLACEHOLDER_PROLINK`), mark that result as **missing** and record which leaves caused it.
5. Run `computeAll(inputs)` for the rest. Any result whose computed value is `NaN`, `null`, or non-finite also becomes **missing**.
6. Render: real number → `fmtNum`; missing → blank cell (`<td class="dt-missing" title="Missing: …">`).

### Two firm invariants

- **No silent defaults.** The advance module never reads `INPUT_META[k].default` as a fallback for compute. If a leaf is not supplied by the bike or its catalog selections, the result is missing — never computed against a default.
- **No placeholder coords.** A linkage selection whose coords match either `LINKAGE_PLACEHOLDER_LINKED` or `LINKAGE_PLACEHOLDER_PROLINK` produces missing results for every linkage-dependent row, even though `closeFourBar` would happily solve them.

## UX

- **Missing cell:** empty `<td>` with `class="dt-missing"` and `title="Missing: <comma-list of leaf input names>"`.
- **Per-row count chip** in the row header showing how many bikes have the value computed: `3/3` green, `2/3` amber, `0/3` grey. Lets the user see which results the catalog is ready for at a glance.
- **No status badges.** No PENDING / STATIC / COORDS / PARTIAL / APPROX. The presence of a number is the proof of realness.
- Catalog-selection dropdowns (clamp / fork / shock / swingarm / linkage) plus the bike-level inputs listed above are the only knobs.

## Testing

### `tests/data-table-advance.test.js`

1. **Row schema integrity** — `ADVANCE_ROW_GROUPS` result rows match the current data-table RESULTS row order exactly.
2. **Dropped-input check** — `Front_Oil_Level`, `Front_Topout_Rate`, `Front_Topout_Length`, `Rear_Topout_Rate`, `Rear_Topout_Length`, `Front_Spring_Preload`, `Rear_Spring_Preload`, `Fork_Position`, `Travel_Front`, `Travel_Rear`, `Lean_Angle`, `a_x`, `V`, `Cd`, `A` do not appear in any input row.
3. **Input-row inclusion** — for each leaf input transitively reachable from the 14 results, assert it is either an editable row or comes from a catalog field.
4. **Missing-input behavior** — given a bike with no linkage selected, the linkage-dependent results (`MotoSPEC_AntSquat`, `Motion_Ratio`, `Progression`, `Rear_Ride_Height`, `Rear_Wheel_Vertical_Travel`, `MotoSPEC_SwgarmAngl`) render as missing.
5. **Placeholder-coords detection** — given a bike whose linkage entry equals `LINKAGE_PLACEHOLDER_PROLINK`, all linkage-dependent rows render as missing even though `closeFourBar` would solve them.
6. **Static at-rest sanity** — given a complete bike with a real catalog linkage: `MotoSPEC_Rake ≈ Rake_Static` (within 1e-9), `Pitch ≈ 0`, `MotoSPEC_FrontForce ≈ Mass · g · front_weight_dist`.

### Reference-bike fixture extension

`tests/fixtures/reference-bikes.json` gains expected `Front_Wheel_Rate` and `Rear_Wheel_Rate` per bike, tolerance 0.5 N/mm. The existing `validation.test.js` then covers both new formulas across all reference bikes.

### Existing tests

Untouched. The legacy data table keeps its mock-tolerant behavior and existing assertions remain valid.

## Implementation order

Top-to-bottom through the 14 RESULTS rows. Each row goes from "missing for every bike" to "real number for every bike whose catalog supplies the inputs":

1. Page scaffold + nav + empty advance table (all cells missing).
2. Wheelbase, Rake, Ground Trail (rows 1, 2, 9) — depend only on bike-level inputs.
3. Front Wheel Force, Rear Wheel Force, CofG % (rows 12, 13, 14) — bike-level only at static.
4. Linkage-dependent rows (3, 4, 5, 6, 7, 8) — once a real linkage catalog entry is selected.
5. Front Wheel Rate, Rear Wheel Rate (rows 10, 11) — adds the two new formulas to `src/formulas.js`.
6. Reference-bike fixture extension + `validation.test.js` coverage of the two new formulas.

Each step gets its own commit and corresponding test.

## Open questions

None at design time. Any ambiguity that surfaces during implementation goes back to brainstorm before code.
