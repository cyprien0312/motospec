# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MotoSpec — a local-first Vue 3 + TypeScript web app for **static** motorcycle chassis setup (rake/trail/wheelbase geometry, sag, weight distribution, anti-squat geometry, gearing). Explicitly out of scope: suspension dynamics, aerodynamics. All persistence is `localStorage`; there is no backend.

## Commands

```bash
npm run dev          # Vite dev server, --host (reachable from the LAN)
npm test             # Vitest, all tests
npx vitest run tests/geometry.spec.ts   # one file
npx vitest run -t "raising the rear"    # by test name
npm run typecheck    # vue-tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run build        # typecheck + vite build
```

## Architecture

**The contract file is `src/core/types.ts`** — every interface, formula, and sign convention is documented there. Read it before touching anything. Key conventions: mm/kg/degrees; rake measured from vertical; positive fork height = tubes up through clamps = front lower; positive rear ride height = rear raised; positive pitch = nose down.

Three layers, strictly one-directional:

1. **`src/core/`** — pure functions, no Vue, no I/O. `tire.ts`, `geometry.ts`, `suspension.ts`, `drivetrain.ts`, `balance.ts`, `presets.ts` are leaf modules; `derive.ts` orchestrates them into a single `deriveState(bike, setup) → DerivedState`. Every core module has a matching hand-computed test file in `tests/` — tests encode physics worked out by hand, not snapshots; don't "fix" a test to match code output without redoing the arithmetic.

2. **`src/store/setups.ts`** — the single Pinia store. Owns bikes (presets + custom), setups, active/baseline selection, localStorage persistence (`motospec.v1`), JSON import/export. `derived` and `baselineDerived` getters call `deriveState`. UI never calls core directly for state — only for stateless helpers (e.g. `parseTire` validation, `analyzeSag` previews).

3. **`src/components/`** — one SFC per surface: `BlueprintView` (the SVG engineering drawing — the app's centerpiece), `SetupPanel` (adjusters), `DeltaDash` (metric cards + warnings), `GarageView` (setup CRUD/compare/export), `SagWizard`. Tabs are wired in `App.vue`; there is no router.

## Testing conventions

- Unit specs (`tire`, `geometry`, `suspension`, `drivetrain`, `balance`) are **hermetic**: where a module imports a sibling, the spec `vi.mock`s the sibling with the exact contract formula from `types.ts`, so each suite passes standalone and a bug in one module can't hide a bug in another.
- `tests/e2e-presets.spec.ts` runs the real, unmocked pipeline over **every preset** and asserts invariants: derived trail within 3 mm of published `refTrailMm`, anti-squat 50–200%, plausible weight split and top-gear speed, and the sign chain (rear up ⇒ rake/trail down, anti-squat up; forks up ⇒ rake/wheelbase down). **Any edit to `presets.ts` or core math must keep this green** — it is the regression net for physical sanity.
- `tests/app.spec.ts` is a jsdom mount smoke test (`// @vitest-environment jsdom` header); everything else runs in node.

## Design system

Tokens in `src/styles/tokens.css` — dark "race paddock engineering drawing" theme. Safety orange = current setup / primary; cyan = baseline ghost; all numerals use `var(--font-mono)` with tabular-nums; headings use `var(--font-display)` (Saira Condensed, uppercase, tracked). Panels use the `.panel` / `.panel-title` chrome from `base.css`. Never hardcode hex colors in components.

## Domain gotchas

- The free-sag spring rule is direction-critical and commonly inverted: too **little** free sag ⇒ spring too **soft**; too much ⇒ too stiff.
- Raising the rear (or pulling forks up through the clamps) must always **decrease** rake and trail. If a change breaks that sign chain, the change is wrong.
- All three chain pitches (520/525/530) are 5/8" = 15.875 mm; chain length rounds **up to even** links.
- `rearRideHeightMm` is defined **at the axle**, not at the shock or linkage shims — there is deliberately no linkage model (linkage ratio never enters static geometry; sag is measured at the wheel too). Don't "add" shock-length inputs without a measured lever ratio.
- Preset comment taxonomy in `presets.ts`: `// approx` = published figure recalled but not re-verified; `// estimated` = never published, engineering estimate. `forkOffsetMm` is back-solved so the trail formula reproduces the published `refTrailMm` — keep that self-consistency when editing presets.
- Estimated fields (swingarm length, pivot height, countershaft position, CG, weight bias, springs) make **absolute** swingarm angle and anti-squat indicative only (±2–3° / ±20–30 pp); **deltas** between setups are robust. Planned fix: 3D-scan import (`src/core/scan.ts`, not yet built) replacing estimates with measured coordinates.
