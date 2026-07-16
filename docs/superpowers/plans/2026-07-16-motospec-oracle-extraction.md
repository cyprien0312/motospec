# MotoSPEC Oracle Extraction — Reverse-Engineering Chassis Data

**Date:** 2026-07-16
**Status:** Plan only.
**Problem it solves:** `docs/research/linkage-coords.md` concluded no OEM
publishes linkage coordinates and physical measurement is the only path.
But the commercial MotoSPEC PRO has the geometry in its bike database, and
its Data Table prints enough *derived* channels that the hidden parameters
can be recovered by treating the software as a black-box oracle: read the
closed-form ones directly, identify the rest by perturbation sweeps.

## The key insight that makes this tractable

We do NOT need the true physical linkage coordinates. In our model the
4-bar linkage influences **every** downstream channel through exactly one
scalar function: `shockLength(δ)` (shock length vs swingarm rotation).
Motion Ratio, Progression, Rear Ride Height, Swingarm Angle, Anti-Squat,
Rear Wheel Rate — all consume the linkage only via that curve. Therefore
**any coordinate set that reproduces the observed shock↔wheel-travel curve
is functionally identical for our purposes**, even if it looks nothing like
the real bike's linkage. We fit an equivalence-class member, not ground
truth. (Cosmetic caveat: the Linkage Setup SVG will draw plausible-but-not-
photorealistic geometry. Label fitted entries `source: "MotoSPEC fit"`.)

## What the oracle displays (from the Panigale V2 screenshot)

Inputs echoed on screen: Yoke Offset, Steering Axis Angle/Offset trims,
Fork Position, spring rates / preload / oil / topout (both ends), Swingarm
Length, RHA, Shock Length, Linkarm Length, rocker name, sprocket teeth,
tire names, potentiometers, lean angle.
Outputs: Rake, Ground Trail, Rear Wheel Travel, Rear Ride Height Reference,
Swingarm Angle (to ground), AntiSquat Angle | Load Transfer Angle,
Progression (per 100 mm wheel travel), Motion Ratio, Wheelbase, Front/Rear
Wheel Rate, Front/Rear Wheel Force, CofG % F/R.

## Recovery routes, parameter by parameter

### A. Free — echoed input fields (read once)

`Yoke_Offset`, `Fork_Position`, `Swingarm_Length`, `Shock_Length`,
spring/preload/topout/oil specs (forks + shocks catalogs), sprocket teeth,
`Shock_Clevis_RHA`, tire spec (→ nominal `Rf`).
Note: their "Steering Axis Offset (5.0 mm)" is a second offset trim —
confirm whether total offset = Yoke Offset + axis offset via the Trail
closure check below.

### B. Closed-form inversion — one static snapshot (pots = 0)

| Ours | Inversion |
|---|---|
| `Rake_Static` | displayed Rake, verbatim (24.04°) |
| `WB` | displayed Wheelbase (1449.9) |
| `beta_static` | −(displayed Swingarm Angle to ground) — sign convention flip (10.96°) |
| `front_weight_dist` | CofG % Front / 100 (0.498) |
| `L_CG` | `front_weight_dist × WB` (CG→rear axle) ≈ 722 mm |
| `H_CG` | from Load Transfer Angle — **convention ambiguity, see probe below** |
| `Rf` | Trail closure: `Rf = (Trail·cos(Rake) + offset) / sin(Rake)` — also disambiguates what "offset" includes; cross-check against tire spec |
| static `Motion_Ratio`, `Progression` | displayed — used as fit residuals, not inputs |

**H_CG probe:** LT angle 26.03° gives `H_CG = L_CG·tan(26.03°) ≈ 353 mm`
(implausibly low) under our `θ_cg = atan(H_CG/L_CG)` convention, but
`H_CG = WB·tan(26.03°) ≈ 708 mm` (plausible) under the Foale
100%-line convention `atan(H_CG/WB)`. Disambiguation: sweep the rear pot
and watch how LT angle responds — the two formulas predict different
trajectories because L_CG and WB shift differently with attitude. Whichever
fits is ALSO the convention our own `theta_cg` should adopt (flagged as a
possible formula fix in `formulas.js`).

### C. Perturbation sweep + fit — the linkage (the actual scan-problem killer)

Unknowns: 10 linkage coords (5 points × XY) + `Linkage_Mode` (try both,
keep the better fit).

Protocol: set Rear Potentiometer = 0, 10, 20 … 100 mm (11 states); at each,
record **Rear Wheel Travel** (they print it — this is the integrated
shock→wheel map directly), Motion Ratio, Swingarm Angle, Rear Ride Height.
Fit the 10 coords so our `linkage.js` forward model reproduces the curve:
Nelder-Mead / coordinate descent over `closeFourBar` — pure Node script,
no dependencies, initial guess = current mode placeholder. Progression and
the static MR pin as extra residuals.

**Sensitivity pinning (critical for the racer use-case):** matching the
shock(δ) curve alone yields an equivalence class whose response to *link-
length edits* (dog bones, linkarm) is NOT guaranteed to match the real
bike's. Since "change the dog bone by 2 mm" is a primary user workflow, the
perturbed-geometry columns (e.g. linkarm 121.6 → 114 from the Panigale
screenshot) go **into the fit residuals** — they pin ∂shock/∂L and collapse
the class to members that also respond correctly to link edits. The held-out
validation gate then uses *different* unseen states (an RHA change + one
mid-travel pot state), not the linkarm columns.

**LINK DIMENSIONS upgrade (2026-07-16, second screenshot):** MotoSPEC's
Link Dimensions dialog exposes the rocker as GROUND-TRUTH link lengths —
e.g. swingarm-mounted rocker (our `pro-link`): Swingarm–Shock 77.70,
Swingarm–Linkarm 45.30, Shock–Linkarm 57.65, Nominal Linkarm 169.20 (=
our closure `L_static`), with a second rocker (BETA: 67.0/35.0/60.0/182.0)
sharing the same anchors. Consequences:
- The rocker triangle is exact, not fitted — free parameters drop 10 → 6
  (rocker pivot on swingarm ×2, frame linkarm anchor ×2, frame shock top
  ×2; static phase absorbed by the linkarm-length constraint).
- The `LINKAGE TYPE` dropdown resolves `Linkage_Mode` outright (swingarm-
  mounted = pro-link, frame-mounted = linked).
- Dog-bone sensitivity is trivially correct: linkarm length is an explicit
  true input, no longer inferred.
- **Joint two-rocker fit:** STOCK + BETA triangles share the 6 anchor
  unknowns → two independent curve families constrain them; identifiable up
  to a mirror branch (Rocker Orientation "NA"), resolved by residual or by
  looking at the bike.
- The Wheel-Rate-vs-wheel-travel chart behind the dialog is a dense oracle:
  digitize ~10 pts/curve, `MR(travel) = sqrt(k_spring / WheelRate)` with the
  displayed spring rate (101 N/mm) → can replace most of the pot sweep.
  Revised minimal budget: **1 static snapshot + 1 Link Dimensions dialog +
  1 wheel-rate chart + 2 held-out states ≈ 5 screenshots per bike.**
  Companion reads: Shock Length (static |shock-top ↔ rocker shock end|
  constraint), the Swingarm Pivot (0,0) row (confirms their origin =
  swingarm pivot, same as ours).

`Front_Sprocket_X/Y`: at each sweep state, chain angle
`θ_chain = f(AntiSquat angle, Swingarm Angle)` by inverting the tan-sum;
θ_chain at 2+ distinct β values → solve the 2 unknowns closed-form
(least-squares over all 11 states in practice; teeth + pitch known).

### D. Not needed from sweeps (don't waste oracle reads)

`Fork_Length` — read it off the fork spec sheet (route A), never fit it:
because `Rake_Static` anchors the absolute attitude, the absolute
yoke→axle distance never appears in any equation; only *deltas* of fork
length/position matter, and those are inputs the user sets, not hidden
geometry (see the attitude-delta chain in the sag-load-case plan — it is a
real physical dependency, just not an extraction target).
`C_f/C_r_aero` (static phase unused), `Mass` (unused since force rows were
removed; Phase-2 sag prediction needs it but that's the user's own bike +
bathroom scale, not the oracle's), `Chain_Pitch` (= 15.875 constant),
`rear_weight_dist` (= 1 − front).

## Recoverable skeleton, front-axle origin (user question 2026-07-16)

With the ≈14 states: yoke position + offset ✅ (steering axis from
Rake/Trail; position along it = `Fork_Length − Fork_Position`, spec-read);
swingarm pivot ✅ horizontally (`WB − L·cos(β)`), ⚠️ vertically (needs rear
loaded radius — nominal tire spec ±3–5 mm; NO channel consumes absolute
verticals, so this only affects drawings, never RESULTS); linkage 5 points
✅ as a functional equivalent (physical truth not identifiable — see
sensitivity pinning); countershaft sprocket ✅ (anti-squat inversion,
relative to pivot).

## Data budget — the answer to "how much data?"

Per bike:

| Block | Oracle states | Yields |
|---|---|---|
| 1 static snapshot (pots 0) | 1 | all of A + B (9 chassis fields) |
| Rear pot sweep, 10 mm steps | 11 | linkage equivalence class (10 coords) + `Front_Sprocket_X/Y` + H_CG convention |
| Held-out validation columns (change ONE of: shock length / linkarm / RHA) | 2 | fit must predict these UNSEEN states — pass/fail gate |

**≈ 14 table states ≈ 7 screenshots** (two columns per screenshot, like the
one already supplied). The existing Panigale V2 screenshot already banks the
2 validation columns (shock 323.5→317, linkarm 121.6→114).

## Deliverables

1. `docs/research/oracle-worksheet.md` — the fill-in recording sheet: what
   to set, which cells to read, per block above.
2. `scripts/fit-linkage.mjs` — offline fitter: input = worksheet JSON,
   output = a ready-to-import linkage catalog entry + chassis profile
   (`source: "MotoSPEC fit (v5.14.3.3)"`), plus fit residuals report.
3. Validation gate: fitted model must reproduce the 2 held-out columns
   within tolerance (Rake ±0.05°, Trail ±0.5 mm, MR ±0.01, ride-height ref
   ±1 mm) before the entry is accepted into `data/*.json`.
4. Feeds `tests/fixtures/reference-bikes.json`: the Panigale V2 numbers
   become the first real validation fixture (see sag-load-case plan).

## Sequencing / dependencies

- Independent of the sag-load-case implementation, but the validation gate
  is stronger once live channels exist (Wheelbase_Live etc. can join the
  residuals).
- Requires the NaN guards (in progress) — the fitter's wild intermediate
  guesses will hit unreachable-geometry paths constantly and must get NaN
  (rejected step), not silent ±45° garbage (corrupted fit).

## Scope note

This identifies parameters from displayed outputs of software the user
licenses, for interoperating with their own measurement workflow — no code,
assets, or databases are extracted or redistributed; fitted entries are
equivalence-class geometry, not MotoSPEC's data.
