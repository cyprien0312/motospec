# Changelog

## v0.1 — Static path complete

First milestone. The static-snapshot calculator is feature-complete: every
input has a home, every RESULTS cell that *can* be computed *is* computed,
and unbound cells say so honestly.

### Pages (sidebar)

- **Dashboard** — formula reference. Every channel + intermediate has its
  own card with prose, formula, deps, drill-down on parameter chips.
- **Chassis Setup** — frame geometry, mass + CG, aero share, tire,
  sprockets. Auto-fitting side-view diagram. Save / load chassis profiles
  to the chassis catalog (`data/chassis.json` ships empty; profiles are
  user-populated).
- **Linkage Setup** — 4-bar linkage editor. Two modes (`linked`,
  `pro-link`) sharing one solver. Two input styles (Cartesian XY,
  lengths-only with chained two-circle intersections). Save as a preset
  to the linkage catalog.
- **Data Table** — variable bike-column comparison (0–5). Picking a
  chassis profile + components materializes the bike's input dict.
  RESULTS cells render real numbers when their leaf inputs are bound,
  otherwise blank with a "Need: …" hint naming the missing provider.
- **Component Library** — five catalogs (chassis / forks / shocks /
  swingarms / linkages). Baseline ⊕ user overlay model with
  import / export / reset. `Yoke_Offset` lives on the chassis profile;
  the original clamp catalog was dropped because its only spec
  duplicated that field.
- **User Guide** — bilingual long-form help with per-page `?` shortcut.

### Calculations wired

- `Trail_Static`, `Rake_Static`-driven trail formulas
- `Final_Ratio = Rear_Sprocket / Front_Sprocket`
- `Front_Wheel_Rate = Front_Spring_Rate · cos²(Rake_Static)`
- `Rear_Wheel_Rate = Rear_Spring_Rate / Motion_Ratio²`
- 4-bar inverse solve (`swingarm_delta_solve`) feeding `Swingarm_Angle`
- `Anti_Squat`, `Progression`, `Motion_Ratio`, `Rear_Ride_Height`
  driven by real linkage coordinates
- Chain geometry: pitch-radius circles + upper / lower tangent runs

### What's NOT in v0.1

- Dynamic readings (compressed-state geometry, dynamic tire forces).
  The DYNAMIC READINGS / DYNAMIC LOAD table groups are removed while
  the dynamic pipeline is rebuilt; placeholder static values stand in.
- Front fork compression / topout simulation (input fields exist with
  `PENDING` badges; no formula consumes them yet).
- Rear shock topout, oil level, preload influences on wheel rate.

### UX guarantees in v0.1

- **No silent placeholder math** — every RESULTS cell that depends on
  unbound inputs renders blank with a hint, never a misleading number.
- **Bilingual zh / en** end-to-end (UI strings, badges, hints, guide).
- **All state in localStorage** — values, bikes, catalog overlay,
  linkage drafts. Catalog "Export JSON" backs up the user overlay.
- **No build step** — pure ES modules over HTTP, Node 22+ for tests.

### Tests

110 / 110 passing across `tests/` (formulas, linkage, chassis-setup,
data-table, catalog, reference-bikes, validation, user-guide).
`tests/fixtures/reference-bikes.json` pins published spec-sheet numbers
for Yamaha R6 / Honda CBR1000RR-R / Ducati Panigale V4 to catch
formula regressions.
