# Changelog

## Unreleased — MotoSPEC v5 parity, first batch

Ported from the commercial MotoSpec v5 teardown
(`docs/research/motospec-v5-teardown.md`). Everything here is closed-form
on values we already carry — no new physics, no new dependencies.

- **Measurement conventions on the chassis profile** — `Fork Position
  Reference`, `Swingarm Length Reference`, `Rear Ride Height Reference`.
  A setup number is only comparable to another if both were taken the
  same way; the shared library needs this most, because the person
  reading a profile is not the person who measured it. Records *how*,
  never *what* — no formula reads them. Default is "not recorded":
  stamping an unstated convention on someone's number is the same class
  of error as inventing the number. Recording a convention the geometry
  chain doesn't implement is allowed, and says "not modelled".
- **Three new RESULTS rows** — Spring Center (rear ÷ front+rear wheel
  rate), Wheelie and Braking acceleration limits (g).
- **Stroke Used %** (front and rear, in LOAD CASE) + the `Fork_Stroke`
  input. Both component-level, so the two ends are directly comparable
  where the raw sag millimetres are not; the rear one solves the shock
  travel through the 4-bar rather than dividing wheel travel by the
  motion ratio.
- **HIGHLITE** — pick a reference column; settings that differ from it
  are highlighted in the other columns. Settings only, never RESULTS.
- **Copy settings between columns** — Front / Rear / All, per column.
  Clears what the source never set, so nothing stale masquerades as
  freshly copied.
- **Setup steps** now match real MotoSPEC's adjustment increments (one
  spinner click = one thing you'd do at the track). The `*_ref`
  baselines keep their finer measurement precision.

### Second batch (P1)

- **Direct / Linkless linkage mode** — the shock bolts straight from the
  swingarm to the frame, no rocker (Yamaha R3, KTM 890/990 Duke). Shares
  the same solver surface but skips the 4-bar closure entirely, so it
  cannot fail to converge. Progression comes out near zero, which is the
  real answer for a linkless rear end, not a missing feature.
- **Display modes on three RESULTS rows** — Anti-Squat (Percent /
  Percent Δ / Angle + Load Transfer Angle / Angle Δ), Motion Ratio
  (Wheel/Shock vs Shock/Wheel) and Progression (% Full Shock Travel vs
  % 100 mm Wheel Travel). The mode changes what the number MEANS; two
  setups compared across different modes is the most common way to
  "find" a discrepancy that was never there.
- **Centre-of-gravity calculator** on the Chassis Setup page — the
  two-condition scale method, several readings averaged into a composite
  CG, with the per-row tilt angle and the advisories the method actually
  needs (raise angle, missing weight, row scatter). Fills Mass, H_CG,
  L_CG and the front weight share in one go, and only on request.
  The weighing protocol is now written up in `docs/measurement-points.md`.
- **"What this tool does not compute"** — a new user-guide section
  listing the model boundaries outright: no lean/tire model, no damping,
  no stiction, no fork air spring, no bump rubbers, no chain force in the
  wheel loads, CG frozen at the attitude it was measured.

### Validated against real MotoSPEC output

`tests/fixtures/motospec-oracle.json` — four bikes × three suspension
positions of genuine MotoSPEC v5 output, from the vendor's own help-manual
screenshots (documentation that ships with the freely downloadable
installer, attributed in the fixture). First time the chain has been
checked against another solver on the same bike at several attitudes
rather than against static spec sheets.

- Topped out: rake, swingarm angle and wheelbase reproduce **exactly**;
  rear ride height within 0.08 mm.
- Up to 40 mm of fork travel: rake within **0.011°**, wheelbase within
  **0.10 mm**, rear ride height within 0.43 mm.
- Beyond that, the flat-plate pitch model under-predicts pitch and the
  error grows to ~1.5° of rake. Those rows pin the known error inside a
  recorded envelope rather than pretending to pass.
- **Bug found and fixed**: `Rear_Ride_Height` was computed from the
  un-pitched swingarm angle. MotoSPEC's Vertical Pivot-Axle is measured
  from a *horizontal* line through the pivot, so it needs the
  ground-referenced angle. The old formula was 44 mm out at 120 mm of
  fork travel. A tire-delta test that asserted the opposite has been
  corrected.

### Real bikes in the catalogs

Five chassis profiles and matched fork/shock setups built from the same
MotoSPEC screenshots (Yamaha R6 2017 FIM, Kawasaki ZX-10R 2016 and 2021,
BMW S1000RR M 2019; Panigale V4 RS gets fork/shock only — its screenshot
has no ground-referenced swingarm angle). Pick a profile plus its shock
and rake, trail, swingarm angle and wheelbase come out matching MotoSPEC
exactly. Pushed to the shared Supabase library and mirrored into the
bundled `data/*.json` for offline/first paint.

Each profile records what is NOT there rather than filling it in: no
mass/CG, no aero share, no sprocket position, no shock stroke — those
rows stay blank. Each also names its rear-suspension construction and
whether this tool can solve it (the BMW is a Full Floater Pro, which it
cannot).

### Readiness follows the calculation actually taken

A RESULTS cell used to demand every input in the worst-case dependency
graph. `swingarm_delta_solve` lists all ten linkage coordinates because
it *might* need them — but at zero shock delta the swingarm does not
move and the solver short-circuits before reading a single one. So a
complete chassis profile was showing "Need: Linkage coords" for rake,
trail and wheelbase that it could compute perfectly well.

Nodes can now declare `skipDepsWhen`. The rule that keeps it honest: the
condition may only be trusted when the keys it reads are themselves
bound — an unbound key still holds its default, and a default proves
nothing. A real shock-length difference brings the linkage requirement
straight back.

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
- **Component Library** — four catalogs (chassis / forks / shocks /
  linkages). Baseline ⊕ user overlay model with import / export /
  reset. The clamp and swingarm catalogs were dropped because their
  only specs (`Yoke_Offset`, `Swingarm_Length`) duplicated chassis-
  profile fields — both now live on the chassis profile only.
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
