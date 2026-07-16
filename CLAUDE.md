# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MotoSPEC Formula Explorer — a static, single-page motorcycle chassis geometry calculator served as plain ES modules over HTTP (no bundler, no build step). The app explores parameter chains for trail/rake, computes 4-bar linkage kinematics, and renders motion-ratio / progression curves. Bilingual UI (zh / en).

## Commands

- Run tests: `npm test` (Node's built-in runner via bare `node --test`; Node 22+. Do not write `node --test tests/` — newer Node 22 rejects a bare directory argument; default discovery finds `tests/**/*.test.js`).
- Run a single test file: `node --test tests/linkage.test.js`
- Run a single test by name: `node --test --test-name-pattern='pro-link' tests/linkage.test.js`
- Local dev server: already running as a systemd user service — `motospec-dev` serves the repo root at `:5173` (`systemctl --user status motospec-dev`; LAN `http://192.168.1.153:5173`). Plain static serving; edit a file, refresh the browser. `index.html` imports modules from `./src/` so the app must be served over HTTP, not opened via `file://`.

There is no lint, no build, no bundler. Don't introduce one without asking.

## Branches, deployment, automation

- **`gh-pages` is the active development branch _and_ the live site.** GitHub Pages serves it directly at https://cyprien0312.github.io/motospec/ — **every push publishes immediately** (no build step, no Actions; an Actions-based deploy is not possible because neither the workflow token nor the stored PAT can enable Pages).
- **`main` holds a parked Vue 3 + TypeScript rewrite** of this app (different architecture, own CLAUDE.md on that branch). The user shelved it in July 2026 — do not develop there or merge between the branches unless explicitly asked. The pristine v0.1 tree is also tagged `v0.1-js`.
- **A nightly cron (23:00) runs `scripts/auto-archive.sh`**: it `git add -A`, commits any working-tree changes as `chore: auto-archive …`, and pushes the current branch (log: `logs/auto-archive.log`, gitignored). Consequence: uncommitted WIP left in the tree goes live on the public site overnight — commit deliberately, and don't leave the tree half-broken at the end of a session.
- `main`'s `docs/` additionally carries `measurement-points.md` + `.svg` (chassis-level points to physically measure on a real bike: RA/FA/SP/CS/SA-U/SA-L/GND-*, origin at rear axle). The linkage-level companion (5 points, origin at swingarm pivot) is this branch's `docs/research/linkage-coords.md`.

## Architecture

### Module layout (ES modules, no bundler)

- `index.html` — the entire UI shell, styles, and DOM wiring. Imports from `./src/*.js` at the top of an inline `<script type="module">`. Because handlers are referenced from inline `onclick` attributes, the module **deliberately re-exposes them via `Object.assign(window, {...})`**. When you add a new inline-handler function, it must be added to that window assignment or the button silently does nothing.
- `src/formulas.js` — pure parameter graph. `P` is the registry of every channel/intermediate node with `formula`, `deps`, units, descriptions. `INPUT_META` declares every leaf input (defaults, min/max/step). `CALC` maps node names → pure compute functions. `TOPO_ORDER` is the topological evaluation order. `defaultValues()` and `computeAll(inputs)` are the public entry points. **No DOM, no i18n, no side effects** — keep it that way; tests import it directly.
- `src/linkage.js` — 4-bar linkage closure kernel. Reference frame: origin at swingarm pivot, +X forward, +Y up, mm. Newton-Raphson closure in `closeFourBar`. Two `Linkage_Mode` values share one solver: `'linked'` (rocker on frame, e.g. R7 / RS660 / Unitrack) and `'pro-link'` (rocker rides the swingarm; Honda family). Pro-Link is implemented as the linked closure with β negated — working in the swingarm's rotating frame. `shockLength` likewise transforms the shock-top point into the swingarm frame in pro-link mode. Don't fork the solver; preserve this trick.
- `src/linkage-setup.js` — render function for the Linkage Setup page (SVG topology, input cards, motion-ratio chart, two input styles: Cartesian XY vs. lengths-only). The lengths-only mode keeps 3 fixed XY anchors (rocker pivot, drag anchor, frame shock top) and 4 measured lengths; geometry is solved by chained two-circle intersections (`circleCircleIntersect`) with branch selection via `pickNearestBranch` (closest to previous solution).
- `src/chassis-setup.js` — render function for the Chassis Setup page. Frame geometry, mass + CG, aero share, tire — all chassis-side inputs that aren't linkage coords or component specs. Auto-fits a traced sport-bike side-view SVG to the user's `WB` and `Rf`; `CHASSIS_GROUPS` defines the field grouping, `CHASSIS_SPEC_FIELDS` the round-trip set saved to / loaded from the chassis catalog. Linked pairs (`front_weight_dist`↔`rear_weight_dist`, `C_f_aero`↔`C_r_aero`) auto-mirror in the `setChassisInput` handler. `Yoke_Offset` and `Fork_Position` belong to the chassis profile (per-bike setup numbers, not fork-side specs).
- `src/data-table.js` — reference-bike comparison table. `ROW_GROUPS` is the section list (FRAME GEOMETRY, FRONT/REAR SETTINGS, SPROCKETS, RESULTS — static-only for now; the DYNAMIC READINGS / DYNAMIC LOAD groups were removed while the static path is being stabilized). Bike columns are variable (0…`MAX_BIKES`=5) — added/removed via `addBike` / `removeBike`. `defaultBikes` seeds three blank columns from `REFERENCE_BIKES`; `blankBike(idx)` mints fresh ones. `bikeReadyKeys(bike)` is the source of truth for which inputs are "really bound" (chassis profile + selected components + per-cell user overrides + `ALWAYS_READY`); RESULTS cells whose leaves aren't all bound render blank with a "Need: …" hint built by `summarizeMissing` + `buildProviderMap`. `CHASSIS_PROVIDED` enumerates which inputs a chassis profile contributes (kept in sync with `CHASSIS_SPEC_FIELDS` in `chassis-setup.js`). `COMPONENT_TO_CATALOG` is exported and is the canonical map — `index.html` imports it; do not redefine locally. Rows can carry a `status` badge (`pending` for inputs not yet consumed by any RESULTS, `static` for results that echo a static input verbatim and don't respond to dynamic load) — corresponding CSS classes live in `index.html` (`.dt-status-*`). The "this row needs real linkage coords" badge was retired once `bikeReadyKeys` started blanking those cells with a "Need: Linkage coords" hint instead.
- `src/reference-bikes.js` — three neutral placeholder columns (`Bike A/B/C`) that `defaultBikes` seeds from. The previous Yamaha R7 / Suzuki GSX-8R / Aprilia RS 660 mockup was removed because its geometry was never accurate enough to validate against. To populate a column: pick a chassis profile + components from the catalogs, or type values into the table cells. `tests/fixtures/reference-bikes.json` is a separate validation harness that pins published spec-sheet numbers (Trail / Wheel Rate) against real bikes (R6, CBR1000RR, Panigale V4) — kept independent of the Data Table seeds. `COMMON_ENV` carries env defaults (`a_x`, `V`, `Cd`, `C_f_aero`, `C_r_aero`) materialized into each bike via `materializeBikeInputs`.
- `src/catalog.js` — component catalog system. `CATALOGS` = baseline JSON (`data/*.json`) ⊕ user overlay (localStorage). Public API: `setCatalogEntry`, `patchCatalogEntry`, `removeCatalogEntry` (tombstones baseline), `getUserOverlay` / `applyUserOverlay` / `resetUserOverlay`, `materializeBikeInputs(bike)` which merges `COMMON_ENV` + selected catalog entries → flat input dict. Four catalog keys: chassis, forks, shocks, linkages. The clamp and swingarm catalogs were removed in v0.1.x because their only specs (`Yoke_Offset` and `Swingarm_Length`) were already chassis-profile fields — having them in two places caused silent overrides during `materializeBikeInputs`. Both fields now live on the chassis profile only. The `chassis` baseline (`data/chassis.json`) starts empty — chassis profiles saved from the Chassis Setup page populate it. Linkage profiles saved from the Linkage Setup page (`buildLinkagePresetEntry` + `slugifyLinkageName` in `src/linkage-setup.js`) round-trip through this catalog. `materializeBikeInputs` flattens chassis specs first so per-bike geometry and component-level specs can override.
- `src/user-guide.js` — bilingual long-form help page rendered at the `__guide` sentinel route. `GUIDE_ANCHORS` enumerates the section ids (`getting-started`, `dashboard`, `chassis`, `linkage`, `datatable`, `catalogs`, `concepts`, `faq`); `renderUserGuide({ lang, anchor })` returns an HTML fragment with `<section id="guide-…">` blocks. The host (`index.html`) drives a fixed `?` button (`.help-fab`) that calls `openGuideForCurrentPage()` → maps `stack[last]` via `PAGE_TO_GUIDE_ANCHOR` → `openGuide(anchor)` which sets `state.guideAnchor` and `navigateRoot('__guide')`. `state.guideAnchor` is one-shot (cleared after the post-render `scrollIntoView`) and intentionally not persisted to localStorage. Drill-down parameter pages fall through to the `dashboard` section. When you add a new top-level page, also add it to `PAGE_TO_GUIDE_ANCHOR` and write a matching guide section.
- `data/*.json` — baseline catalog entries (`forks.json`, `shocks.json`, `linkages.json`, `chassis.json`), loaded via JSON Import Attributes (`import X from '../data/x.json' with { type: 'json' }`). Requires Node 22+; TS LSP needs `jsconfig.json` (`module: ESNext`, `moduleResolution: Bundler`, `resolveJsonModule: true`) to avoid false-positive diagnostics on the `with` syntax. Don't downgrade to fetch/`require` — keep the native import. `chassis.json` ships empty; populated via the Chassis Setup page.

### State + render model in `index.html`

- A single `state` object (values, lang, current page). `renderContent()` re-renders the active page by replacing `#content.innerHTML`. This destroys focus, so:
- **`patchLinkageView()` does a scoped DOM swap** of just `.linkage-svg`, `.linkage-readout-strip`, and `.linkage-chart-wrap` to preserve focus while typing in input fields. When you add new live-updating regions to the linkage page, either include them in the patch or accept that they'll only refresh on a full re-render.
- Bilingual strings live in parallel `UI.zh` / `UI.en` tables inside the renderers; lang is part of `state` and toggled by a button.

### Linkage modes — placeholders and defaults

- Default `Linkage_Mode` is `'pro-link'` (per `defaultValues()`).
- Each mode has a baseline coordinate placeholder (`LINKAGE_PLACEHOLDER_LINKED`, `LINKAGE_PLACEHOLDER_PROLINK`). `setLinkageMode` auto-swaps placeholders **only if the user hasn't customized values** — `matchesPlaceholder` is the gate. If you change a placeholder, also update the test in `tests/linkage-setup.test.js` if it checks specific values.

### Tests

- `tests/validation.test.js` is the reference-bike parity harness. It diffs `computeAll` output against `tests/fixtures/reference-bikes.json` per-bike with a per-bike `tolerance_mm` (default 1 mm). When changing any formula, run the full test suite and inspect this file's output before assuming nothing broke.
- The English-render assertion in `tests/linkage-setup.test.js` deliberately matches `/Rocker Pivot/` (mode-agnostic) because the label differs between linked and pro-link modes.

### Conventions worth preserving

- `src/formulas.js` and `src/linkage.js` are pure; tests rely on this.
- Inline `onclick` handlers are intentional, not legacy — keep the `window` exposure pattern when adding new buttons.
- All units are mm and degrees unless explicitly converted via `D2R` / `R2D`.
- Reference docs live under `docs/` (e.g. `docs/research/linkage-coords.md` for the Melotti-style coordinate description that informs the SVG layout).
