# Triumph Street Triple RS 765 — real MotoSPEC PRO data

**Date:** 2026-07-16. **Source:** two user-supplied screenshots of MotoSPEC
PRO (ukracesupport.com build): the main Data Table with three columns
(identical bike, Yoke Offset 26.0 / 27.5 / 29.0) and the LINK DIMENSIONS
dialog for the STOCK linkage. Bike labelled "Triumph Street Triple RS 765
2020"; **the model year of the STOCK linkage entry is uncertain** (user
note) — the 765 linkage has been stable across Street Triple generations
but treat the dims as "a stock 765 link", not "certified 2020".

This is the first bike with real (partially measured) linkage data —
catalog entries: chassis `street-triple-rs-765-2020`, linkage
`triumph-765-stock-fit`, fork `showa-bpf-765`, shock `ohlins-stx40-765`.
Parity pins live in `tests/triumph-765.test.js`; the coordinate fit is
reproducible via `node scripts/fit-linkage-765.mjs`.

## LINK DIMENSIONS dialog (measured — hard data)

Linkage type: **SWINGARM-MOUNTED ROCKER** → our `pro-link` mode.

| Dimension | mm |
|---|---|
| Swingarm–Shock (rocker pivot → shock eye on rocker) | 77.70 |
| Swingarm–Linkarm (rocker pivot → linkarm eye on rocker) | 45.30 |
| Shock–Linkarm (third rocker triangle side) | 57.65 |
| Nominal Linkarm Length | 169.20 |
| Nominal Shock Length | blank (shock spec says 283.0) |
| Rocker Orientation | NA |

## Main table (columns differ ONLY in Yoke Offset)

Inputs: Fork Position 28.0; Showa BPF (spring 9.0 N/mm, preload 8.0, oil
**200 cc — a volume; our `Front_Oil_Level` is a level in mm, so not
mapped**, topout 4.0 / 40.0); Swingarm 594.5 mm; Öhlins STX40 (length
283.0, spring 100.0, preload 12.0, topout rate 188.0, topout length
blank); tires Pirelli SBK 125/70 + 190/60; sprockets 16/46 (2.875);
potentiometers 0 (Manual).

| RESULTS | O=26.0 | O=27.5 | O=29.0 |
|---|---|---|---|
| Rake (deg) | 23.7 | 23.68 | 23.66 |
| Normal Trail (mm) | 96.4 | 94.8 | 93.2* |
| Ground Trail (mm) | 105.3 | 103.5 | 101.7 |
| Rear Wheel Vertical Travel (mm) | 0 | 0 | 0 |
| Rear Ride Height Reference (mm) | −125.9 | −125.7 | −125.4 |
| Swingarm Angle to ground (deg) | −12.2 | −12.2 | −12.18 |
| AntiSquat (%) | 113.1 | 113.2 | 113.3 |
| Progression, Full Shock Travel (%) | 25.6 | 25.6 | 25.6 |
| Motion Ratio (wheel/shock) | 2.458 | 2.458 | 2.458 |
| Wheelbase (mm) | 1414.3 | 1415.7 | 1417 |
| Front Wheel Rate (N/mm) | 32.37 | 32.35 | 32.35 |
| Rear Wheel Rate (N/mm) | 47.54 | 47.54 | 47.54 |
| Front \| Rear Wheel Force | −92.8 \| −98.6 (all) | | |
| CofG % Front / Rear | 49.8 / 50.2 (all) | | |

\* col-3 normal trail partially legible; consistent with the closed form.

MR chart: wheel/shock starts 2.458 at 0 travel, near-linear decline to
≈1.955 at 135 mm wheel travel; rear wheel rate (dashed) rises accordingly.
Note the ride-height reference here is **negative** (axle below pivot),
matching our convention — unlike the Panigale screenshot in the sag plan,
which displayed it positive.

## Derivations (all verified in tests)

- **Rf = 304.6 mm** from the trail identity: (105.3·cos 23.7° + 26)/sin 23.7°.
  Cross-check: Normal Trail 304.6·sin 23.7° − 26 = 96.4 ✓; columns 2–3
  reproduce 103.5 / 101.8 ✓. Their trail formula is exactly ours.
- **β_static = 12.23°** from RRH: asin(125.9 / 594.5) ✓ (display −12.2).
- **Rear Wheel Rate 47.54 ≈ (100 + 188)/2.458² = 47.67** → their wheel
  rate includes the **topout spring in parallel** at zero compression.
  Ours is main-spring only (16.55). Documented model difference.
- **Front Wheel Rate 32.37**: formula not yet identified (9 N/mm spring →
  ours 7.55). Likely two legs + air-spring/topout terms. Open question.
- **Full travel 135 mm** → swingarm sweeps 12.23° → −0.88°, i.e. 13.11° of
  bump; shock stroke ≈ 61.5 mm.
- **Their rake responds to yoke offset** (23.7 → 23.66 over +3 mm): their
  absolute frame model sees the front-height change; we hold `Rake_Static`.
  Costs ≤ 0.35 mm of trail across these columns.
- **Their wheelbase responds to offset**: +3 mm offset → +2.7 ≈ 3·cos 23.7°.
  Now modeled: `Wheelbase_Live` carries a `(Yoke_Offset − Yoke_Offset_ref)·
  cos(Rake)` term plus the live-vs-ref swingarm projection (chain-adjuster
  moves), pinned against the oracle's 1415.7 / 1417 columns. WB is a
  one-time reference measurement, never hand-edited for adjustments.

## The coordinate fit (oracle extraction, first success)

The dialog gives the link **lengths** but not where the parts sit. Per the
oracle-extraction plan we fitted an equivalence-class member: the rocker
triangle + linkarm + shock lengths are held exact **by construction**, and
5 placement parameters (rocker pivot x/y, rocker orientation, linkarm
direction, shock direction) were optimized (multi-start Nelder–Mead,
`scripts/fit-linkage-765.mjs`, ~9 s) against MR(0)=2.458 and the chart's
near-linear decline to 1.956 at 135 mm.

Refit 2026-07-16 with owner-supplied layout constraints (screen-left =
+X forward, SVG numbering): ⑥ below/under ①, ⑦ forward of ③④⑤, ③ below
the ①–② swingarm line, ④ forward of ③⑤, ⑤ forward of ③. Result
(objective 1.4e-5 — all five MR targets within 0.003, every constraint
satisfied):

| Point | x | y |
|---|---|---|
| ③ Rocker pivot (on swingarm) | −238.0 | −147.7 |
| ④ Rocker→shock eye | −169.5 | −184.5 |
| ⑤ Rocker→linkarm eye | −226.7 | −191.6 |
| ⑥ Linkarm frame anchor | −67.1 | −135.4 |
| ⑦ Frame shock top | −28.4 | 60.8 |

shock(0) = 283.00; stroke 61.5 mm over 135 mm travel; progression over
full travel ≈25.6 vs oracle 25.6. Layout now matches the real bike's
qualitative arrangement (rocker hanging under the swingarm, linkarm
anchor below the pivot, shock leaning forward-up to a mount ahead of the
rocker) but exact positions remain approximate — label stays
"MotoSPEC fit".

**This fit also exposed a real bug:** our `progression()` (and the
Linkage Setup MR chart) swept the swingarm in the droop direction
(+δ) while calling it "full bump". Swept toward bump (−δ, compression =
axle up = β decreasing) the fitted 765 gives 25.7% vs the oracle's 25.6;
the droop sweep gave 39%. Both sweeps now run in the bump direction.

## What the chassis profile carries — geometry only, by decision

The profile carries ONLY frame-intrinsic geometry that survives a race
conversion: Rake 23.7, WB 1414.3, swingarm 594.5, β 12.23, yoke offset
26.0, fork position 28 (=ref), shock ref 283, Rf 304.6 (derived), chain
pitch. Fork length is handled as a typed measured DIFFERENCE
(`Fork_Length_Delta`, 0 = same fork) — no fork's absolute length is
known, so no absolute is stored anywhere (zero-fake-data).

Mass / weight split / CG / aero / front-sprocket position are
**deliberately absent** (user decision 2026-07-16): the user's bike is a
stripped race build, so the oracle's mass data (which was also internally
inconsistent — CofG 49.8/50.2 vs wheel forces 48.5/51.5, rider model
unknown) does not transfer. Dependent RESULTS (Anti-Squat) blank honestly
until the user measures their own bike and saves a personal profile
variant via Chassis Setup. For reference, the oracle displayed: CofG
49.8/50.2, wheel forces 92.8/98.6 kg, Anti-Squat 113.1%.

To fill in (owner measurements on the race bike):
- **Front sprocket position** (2 numbers, frame-intrinsic — stripping
  parts doesn't change it): countershaft center ↔ swingarm pivot center,
  horizontal + vertical. Unlocks the thrust-angle half of Anti-Squat.
- **Wheel weights** (with rider, race trim) → Mass, weight split, and
  L_CG = front share × WB.
- **H_CG**: raised-axle weighing method, or defer — Anti-Squat stays
  blank until it exists.

## Race-support spec sheet (user-supplied, 2026-07-16 — OEM standard data)

Second independent source, OEM standard setup (vs the oracle bike's
custom springs):

| | FRONT — Showa 41 BPF | REAR — Öhlins "40/14" piggyback (STX40) |
|---|---|---|
| Std spring rate | 8.0 N/mm | 95 N/mm |
| Unladen / laden sag | 13 / 38 mm | 13 / 40 mm |
| Oil | 5 wt, air gap **85 mm** | 2.5 wt, gas 10 bar |
| **Length** | **730.0 mm** | **280.0 mm (nominal)** |
| **Stroke** | 115 mm | **60 mm** |

Reconciliation with the oracle:
- **Shock 283 vs 280**: the STX40 has a length adjuster — the oracle bike
  ran +3 mm over nominal. `Shock_Length_ref` stays 283 (the state at
  which rake/WB were read); fitting a nominal-length shock is a real
  −3 mm delta (rake opens ~0.3°, rear ride height +7 mm — the delta
  chain working as intended).
- **Springs 8.0/95 (OEM) vs 9.0/100 (oracle bike)**: the oracle bike had
  stiffer springs fitted. Both setups are real → two catalog entries per
  end (`…-765` = oracle setup, `…-765-oem` = this sheet).
- **Rear stroke 60 mm independently confirms the linkage fit**, which
  predicted 61.5 mm of shock compression over the chart's 135 mm wheel
  travel (2.5% off, and the oracle's effective sweep may include the
  topout region — its 25.6% vs our stroke-based 25.0%).
- **Fork length 730 mm is the first real absolute** — stored on both
  Showa entries (hardware-intrinsic). The live chain still uses
  `Fork_Length_Delta`; absolutes can rejoin once more forks have one.
- Sag targets (13/38 front, 13/40 rear) are the OEM recommendation — type
  the *measured* values into LOAD CASE; these are what to aim for.

`Progression` now derives its sweep from `Shock_Stroke` (real 60 mm)
via the 4-bar inverse solve — "% Full Shock Travel" is finally literal,
matching real MotoSPEC's definition. Shocks without a known stroke leave
the Progression cell blank (honest).

## Open questions

1. Front Wheel Rate 32.37 formula (two legs? air spring? topout?).
2. Front sprocket position for the 765 → would let us pin Anti-Squat 113.1.
3. Their CofG 49.8/50.2 vs wheel forces 92.8/98.6 (48.5/51.5) disagree —
   presumably different mass models; we adopted the CofG display.
4. Linkage model year (user: uncertain which year this STOCK link is).
