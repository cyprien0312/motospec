# Yamaha R7 / Suzuki GSX-8R / Aprilia RS 660 Factory — MotoSPEC PRO screenshot extraction

**Date:** 2026-07-17. **Source:** one user-supplied screenshot of MotoSPEC
CHASSIS PROGRAM **v5.16.0.0 PRO**, main Data Table with three columns +
Shock/Wheel chart. File in title bar:
`D:\AAA_MotoSPEC\v5_files\Aprilia\RS 660 Factory 2025\Aprilia_RS_660_Factory_2025.MS1 (modified)`.

**⚠️ This is NOT a static snapshot.** All three columns carry a DYNAMIC
READINGS preset (Sag / Braking / Mid-Corner) with non-zero potentiometers,
so the RESULTS block is at three *different* dynamic states — columns are
not comparable to each other, and route-B closed-form inversion
(Rake_Static, WB, β_static, CofG from the oracle plan) **cannot** be banked
from this screenshot. Still banked: all route-A echoed inputs, plus the
dynamic-state identities verified below.

| Column | 1 (red) | 2 (teal) | 3 (purple) |
|---|---|---|---|
| Bike | Yamaha R7 2022 | Suzuki GSX-8R 2024 | Aprilia RS 660 Factory 2025 |
| Preset | Sag | Braking | Mid-Corner |

Cells marked `?` were not legible at screenshot resolution.

## FRONT SETTINGS

| Field | R7 | GSX-8R | RS 660 |
|---|---|---|---|
| Clamp/Yoke Name | Stock | — | — |
| Yoke Offset (mm) | 35.0 | 30.0 | 28.0 |
| Steering Axis Angle (deg) | 0.00 | 0.00 | 0.00 |
| Steering Axis (mm) | 0.00 | 0.00 | 0.00 |
| Fork Position (mm) | 5.0 | ? (blank) | 10.0 |
| Fork Name | FGK242 | Showa | FL 23030 |
| Spring Rate L/R (N/mm) | 9.0 / 9.0 | 8.5 / 8.5 | 9.5 / 9.5 |
| Spring Preload L/R (mm) | 10.0 / 10.0 | 10.0 / 10.0 | 5.0 / 5.0 |
| Oil Level (mm) or Volume (cc) L/R | 170.0 / 170.0 | 180.0 / 180.0 | 125.0 / 125.0 |
| Topout Spring Rate L/R (N/mm) | 4.0 / 4.0 | 4.0 / 4.0 | 3.5 / 3.5 |
| Topout Spring Eff. Length L/R (mm) | 40.0 / 40.0 | 40.0 / 40.0 | 40.0 / 40.0 |

## REAR SETTINGS

| Field | R7 | GSX-8R | RS 660 |
|---|---|---|---|
| Swingarm Name | Yamaha R7 20… | Suzuki GSX-8… | Aprilia RS 660 |
| Swingarm Length (mm) | 533.0 | 586.4 | 546.3 |
| Shock Clevis RHA (mm) | 0.0 | 0.0 | 0.0 |
| Shock Name | YA 589 | Showa | AP660 |
| Shock Length (mm) | 310.0 | 309.6 | 309.0 |
| Spring Rate (N/mm) | ? (dropdown, value hidden) | 135.0 | 160.0 |
| Spring Preload (mm) | 14.0 | 15.0 | 7.0 |
| Topout Spring Rate (N/mm) | 188.0 | 188.0 | ? |
| Topout Spring Eff. Length (mm) | 8.0 | 8.0 ? | ? |
| Swingarm Pivot trims (mm) | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| Link Name | R7 | STOCK | ? (greyed) |
| Linkarm Length (mm) | 92.00 | 128.90 | 0.00 (greyed) |

RS 660's greyed Link Name + Linkarm 0.00 suggests its linkage entry is
incomplete in this file — do not trust its Progression/MR rows as
linkage-fit residuals until a Link Dimensions dialog is captured.

## TIRES / SPROCKETS

| Field | R7 | GSX-8R | RS 660 |
|---|---|---|---|
| Front Tire | Pir SBK 120/70 | Pir SBK 120/70 | Pir SBK 120/70 |
| Rear Tire | Pir SBK 180/60 | Pir SBK 180/60 | Pir SBK 180/60 |
| Sprockets F \| R | 16 \| 42 | 17 \| 47 | 17 \| 43 |
| Final Ratio | 2.625 ✓ | 2.765 ✓ | 2.529 ✓ |

(✓ = ratio recomputed from teeth, matches display exactly.)

## DYNAMIC READINGS (the load state each column's RESULTS are at)

| Field | R7 | GSX-8R | RS 660 |
|---|---|---|---|
| Preset Name | Sag | Braking | Mid-Corner |
| Front Potentiometer (mm) | 30.0 | 120.0 | 80.0 |
| Rear Potentiometer (mm) | 10.0 | 2.0 | 20.0 |
| Lean Angle (deg) | 0.0 | 0.0 | 55.0 |

## RESULTS (dynamic, per-column state — NOT static geometry)

| Channel | R7 @ Sag | GSX-8R @ Braking | RS 660 @ Mid-Corner |
|---|---|---|---|
| Rake (deg) | 24.27 | 21.09 | 21.13 |
| Ground Trail (mm) | 97.8 | 84.3 | 76.7 |
| Rear Wheel Vertical Travel (mm) | 25.2 | 5.3 | 52 |
| Rear Ride Height Reference (mm) | −77.6 | −63.4 | −46.3 |
| Swingarm Angle to ground (deg) | −8.37 | −6.21 | −4.86 |
| AntiSquat (%) | 109.2 | 98.8 | 88.3 |
| Progression, Full Shock Travel (%) | 16.9 | 34 | 5.2 |
| Motion Ratio (wheel/shock) | 2.488 | 2.672 | 2.564 |
| Wheelbase (mm) | 1403.5 | ? | 1360.7 |
| Front Wheel Rate (N/mm) | 33.74 | 28.96 | 31.85 |
| Rear Wheel Rate (N/mm) | 18.97 | 45.91 | 24.61 |
| Front Wheel Force (N) | 754.9 | 2801.6 | 2087.8 |
| Rear Wheel Force (N) | 1151.3 | 469.2 | 1781.3 |
| CofG % Front | 44.6 | 52.4 | ? |
| CofG % Rear | 55.4 | 47.6 | ? |

## Identities verified (read-confidence checks)

- **Swingarm angle = asin(RRH / Swingarm Length)** holds for all three:
  asin(77.6/533.0)=8.37°, asin(63.4/586.4)=6.21°, asin(46.3/546.3)=4.86°
  — same identity the 765 doc verified; also confirms the −4.86 reading of
  the partially legible col-3 cell, and confirms their RRH is measured
  along the swingarm from the pivot, matching our convention.
- **Chart markers = 1/MR:** 1/2.488=0.402, 1/2.672=0.374, 1/2.564=0.390,
  each marker sits at (travel, shock/wheel) = (25.2, 0.402) /
  (5.3, 0.374) / (52, 0.390) on the dashed curves. ✓
- **Final ratios** recompute exactly from teeth. ✓
- CofG rows sum to 100 where legible. ✓

## Shock/Wheel chart (right axis, dashed curves) — approximate digitization

X = rear wheel vertical travel 0→140 mm; markers at current state.

| Bike | shock/wheel @ 0 | @ current (marker) | @ 140 mm | Shape |
|---|---|---|---|---|
| R7 (red) | ≈0.395 | 0.402 @ 25.2 | ≈0.455 | steady rise (prog 16.9%) |
| GSX-8R (teal) | ≈0.373 | 0.374 @ 5.3 | ≈0.51 | strongly progressive (prog 34%) |
| RS 660 (purple) | ≈0.385 | 0.390 @ 52 | ≈0.40 | near-flat (prog 5.2%) — but linkage entry incomplete, treat as suspect |

Screenshot-resolution digitization is ±0.005-ish — good enough for a fit
initial guess, not for residual pinning; per the oracle plan, prefer the
Link Dimensions dialog + a pot sweep for the real fit.

## What this banks vs. what's still missing (per the oracle-plan data budget)

Banked per bike: route-A inputs (yoke offset, fork position, spring/
preload/oil/topout, swingarm length, shock length, linkarm length,
sprockets, tires) + one dynamic validation state each.

Still needed per bike to finish extraction:
1. **Static snapshot (pots = 0, lean 0)** — unlocks Rake_Static, WB,
   β_static, CofG %, Rf via trail closure (route B).
2. **Link Dimensions dialog** — rocker triangle ground truth + linkage
   type (route C, drops fit unknowns 10 → 6). Critical for RS 660 whose
   link entry is greyed/0.00 here.
3. Rear pot sweep or the wheel-rate chart at higher resolution — curve
   residuals for the coordinate fit.
4. Illegible cells: R7 rear spring rate, GSX-8R fork position + wheelbase,
   RS 660 rear topout pair + CofG %.
