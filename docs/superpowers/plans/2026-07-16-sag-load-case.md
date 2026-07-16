# Sag Load Case — Design Plan

**Date:** 2026-07-16
**Status:** Plan only — implementation not started. A separate session is
currently landing the NaN-guard fixes in `src/linkage.js`; those land first
(the sag solve path calls straight into the guarded code).

## Goal

Add a **sag load case** to the Data Table: the user types the sag they
measured (or leaves 0 = unloaded reference), and the existing RESULTS
channels become **live** — computed at that suspension position, exactly like
the real MotoSPEC (single RESULTS block; its potentiometer inputs at 0 give
the static values). No echo rows at all — static rake exists only as the
chassis-profile input, same as real MotoSPEC. No sensors, no dynamics — this
is still a static equilibrium snapshot, just at a different suspension
position.

## Non-goals (this phase)

- Predicting sag from spring rate / preload / topout (that is Phase 2 — the
  inputs already exist with PENDING badges; a predicted-vs-measured
  cross-check row is the payoff later).
- Braking / mid-corner / aero load cases (`DYNAMIC_PRESETS` stays dormant).
- Free-sag vs rider-sag distinction (would need a bike-only mass input —
  explicitly rejected to keep the input count flat).
- Tire loaded-radius change under load (ignored, documented).

## New inputs — exactly two, both defaulting to a REAL value

| Input | Unit | Default | Meaning |
|---|---|---|---|
| `Sag_Front` | mm | **0** | Fork compression from the reference attitude, measured **along the fork axis** (zip-tie convention) |
| `Sag_Rear`  | mm | **0** | Rear wheel compression from the reference attitude, measured **vertically at the axle** |

Honesty rules (this is the part that keeps the no-fake-data invariant):

- Default **0 means "no load applied"** — a physically true statement, not a
  placeholder. Both keys therefore join `ALWAYS_READY` (same rationale as
  `Shock_Clevis_RHA`).
- The "typical 30 mm" suggestion is a **placeholder hint / tooltip only**
  (`INPUT_META` hint text). It must never silently participate in a
  computation. If the user wants 30, they type 30.
- At `Sag_* = 0`, every `_Sag` channel must equal its static counterpart
  exactly (pinned by test).

**Reference-state contract (pin this in the docs and the input tooltips):**
`Rake_Static`, `beta_static`, `WB` describe the bike at whatever attitude the
user measured/spec'd them. `Sag_*` is *additional compression relative to
that same attitude*. We do not try to police which attitude that is — we just
require the user be consistent.

## Channel changes (decision: ONE live RESULTS set, no `_Sag` row family)

Per user direction (2026-07-16, after comparing against a real MotoSPEC PRO
5.14.3.3 screenshot): **do not duplicate rows into static/`@ Sag` pairs.**
The real MotoSPEC has a single RESULTS block, all values computed at the
current load state (its DYNAMIC READINGS potentiometers play the role our
sag inputs play; at pots = 0 the live values degenerate to static). We mirror
that: the existing channels become live, driven by the sag inputs.

| Channel | Change | Formula at load state |
|---|---|---|
| `Pitch_Sag` (new intermediate) | nose-down positive | `atan( (Sag_Front·cos(Rake_Static) − Sag_Rear) / WB )` — the `cos` projects fork-axis travel to vertical (the correction the dormant `P.Pitch` lacks) |
| `delta_beta_sag` (new intermediate) | compression → β decreases | `−asin(Sag_Rear / Swingarm_Length)` |
| `MotoSPEC_Rake` | echo → **live** (this is what its `note` always promised) | `Rake_Static − Pitch_Sag·R2D` |
| `MotoSPEC_Trail` | automatically live | unchanged formula — it already consumes `MotoSPEC_Rake` |
| `Swingarm_Angle` | add sag + pitch terms | `beta_static + swingarm_delta_solve + delta_beta_sag·R2D − Pitch_Sag·R2D` |
| `Anti_Squat` | automatically live | unchanged — consumes `Swingarm_Angle` |
| `Motion_Ratio` | evaluate at load point | `motionRatio(cfg, δ_sag, …)` — solver already takes the delta parameter |
| `Rear_Wheel_Rate` | automatically live | unchanged — consumes `Motion_Ratio` |
| `Rear_Ride_Height` | add sag delta | evaluate wheel height at `swingarm_delta_solve + delta_beta_sag` |
| `Wheelbase_Live` (new channel) | replaces the WB echo row | `WB − Sag_Front·sin(Rake_Static) + Swingarm_Length·(cos(β_live) − cos(β_static))` — matches real MotoSPEC, where WB is a computed output that moves with shock length (screenshot: 1449.9 → 1446.7 when shock 323.5 → 317) |
| `Progression` | unchanged | full-travel sweep property, not a point value |

No new kernels; every change reuses `linkage.js` solvers already covered by
tests. At `Sag_* = 0` and `RHA = 0` every live channel equals today's static
output (pinned by test).

Worked sanity example (also a test): Rake 24°, WB 1400, Sag_Front = Sag_Rear
= 30 → ΔZ_front = 30·cos 24° ≈ 27.4 < 30 → slight nose-UP pitch →
`MotoSPEC_Rake` ≈ 24.1°. Equal sag numbers do **not** mean unchanged
attitude; the fork-axis projection is why.

## Data Table changes

- New input group **`LOAD CASE (载荷状态)`** after REAR SETTINGS with the two
  sag input rows (hint text: "typical 25–35 mm"). This mirrors real
  MotoSPEC's DYNAMIC READINGS group (Front/Rear Potentiometer, Manual
  preset).
- **RESULTS stays a single block, all live — zero echo rows** (user decision
  2026-07-16: no `Rake (static)` reference row either; real MotoSPEC doesn't
  show one, and static rake is readable in the chassis profile / at sag = 0).
  With the echo rows gone, the `STATIC` badge machinery loses its last
  RESULTS user and can be retired.
  - `Wheelbase (mm)` row switches from echoing `WB` to the computed
    `Wheelbase_Live` (badge dropped — it responds to load/geometry now).
  - **Remove pure-echo rows:** `CofG % Front` / `CofG % Rear` (verbatim
    `front/rear_weight_dist` echoes; static weight split is visible on the
    Chassis page). Real MotoSPEC computes these from its mass model — until
    we have one, showing an echo dressed as a result is exactly what the
    honesty rules forbid.
- **Slim the input side** ("去掉回显输入"): the FRAME GEOMETRY group drops
  the chassis-domain echo rows (weight dist / aero shares — read-only echoes
  since the domain-enforcement fix) and keeps only the Chassis profile
  selector. Chassis geometry is defined in Chassis Setup, full stop — same
  shape as real MotoSPEC, whose table shows only component/setup rows plus
  dropdown references to named definitions.
- Readiness gating is automatic: live-channel leaves = static leaves ∪
  `{Sag_Front, Sag_Rear}`, and the sag keys are ALWAYS_READY. Zero new
  gating logic.

## Validation fixture — real MotoSPEC PRO output (user-supplied screenshot)

Ducati Panigale V2 2020, two columns differing only in shock length
(323.5 → 317 mm) and linkarm length (121.6 → 114 mm). Once that bike's
chassis + linkage coords are measured, these pin the live channels:

| Channel | Col 1 | Col 2 |
|---|---|---|
| Rake (deg) | 24.04 | 23.46 |
| Ground Trail (mm) | 101.9 | 98.4 |
| Rear Ride Height Reference (mm) | 244.7 | 259.2 |
| Swingarm Angle to ground (deg) | −10.96 | −11.99 |
| AntiSquat Angle \| Load Transfer Angle (deg) | 31.55 \| 26.03 | 32.81 \| 26.31 |
| Progression, 100 mm wheel travel (%) | 1.2 | 3 |
| Motion Ratio (wheel/shock) | 1.998 | 2.023 |
| Wheelbase (mm) | 1449.9 | 1446.7 |
| Front \| Rear Wheel Rate (N/mm) | 34 \| 60.6 | 33.7 \| 58.95 |

Convention mapping notes (theirs → ours): swingarm angle signed to-ground
(−10.96) vs our positive-below-horizontal `beta_static`; ride-height
reference positive vs our negative axle-below-pivot; their Progression is
quoted over 100 mm wheel travel (ours currently sweeps a 25° swingarm-angle
range — align when wiring the fixture). Their shock-length-driven attitude
change enters our model through the RHA/target-length solve path.

## Tests

1. **Degeneracy:** `Sag_* = 0` (and RHA 0) ⇒ every live channel === current
   static output (live Rake === `Rake_Static` input, etc.).
2. **Direction:** `Sag_Front`↑ ⇒ live Rake↓, Trail↓, `Wheelbase_Live`↓;
   `Sag_Rear`↑ ⇒ live Rake↑, `Swingarm_Angle`↓ (toward horizontal).
3. **Projection pin:** the 24°/1400/30/30 worked example above.
4. **Cross-column direction (from the fixture):** shortening the shock
   6.5 mm must lower the rear (ride-height ref ↑ in their convention), close
   the swingarm angle by ≈ 1°, reduce rake ≈ 0.6°, and shorten wheelbase
   ≈ 3 mm — direction-level assertions now, exact pins once coords are
   measured.
5. **Gating:** live rows blank without chassis+linkage bound, render with
   them bound even when sag inputs untouched (0 is real).

## Sequencing

1. (Other session) NaN guards in `closeFourBar` / `swingarmDeltaForShockTravel`.
2. `formulas.js`: inputs + `_Sag` channels + TOPO entries (pure, testable).
3. `data-table.js`: LOAD CASE group + RESULTS rows + ALWAYS_READY additions.
4. `index.html` window-exposure check (no new handlers expected — existing
   `setBikeInput` covers the new input rows).
5. User guide: new "Load case / Sag" subsection in the datatable anchor.
6. Phase 2 (separate plan): predicted sag from spring data → consumes the six
   PENDING inputs; predicted-vs-measured delta row as a spring-rate
   diagnostic.
