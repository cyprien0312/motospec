# Linkage coordinate research notes

Goal: source 5 coordinate pairs (Frame_Rocker_Pivot, Rocker_To_Shock,
Rocker_To_Drag, Drag_To_Swingarm, Frame_Shock_Top) for the three
reference bikes (origin = swingarm pivot, +X forward, +Y up, mm).

Outcome: **No usable real coordinates found for any of the three bikes.**
Placeholder coordinates retained in `src/reference-bikes.js`. Phase C
numeric pin tests for MotionRatio / Rear_Travel / Rear_RHR are
SKIPPED (guarded by `hasRealCoords()`).

## Yamaha R7 2022

Sources tried:
- Manufacturer materials: 2022 R7 owner's manual (no linkage geometry,
  only spring/damper specs and travel).
- Aftermarket vendors: Yoshimura YZF-R7 suspension linkage kit,
  Soupy's Performance lowering links, LUST Racing lowering kit. None
  publish bare pivot coordinates; they ship parts referenced to OEM
  geometry without disclosing it.
- Forum threads: nothing measured / digitized.

Result: placeholder retained.

## Suzuki GSX-8R 2024

Sources tried:
- Suzuki global product page and 2025 UK spec sheet (general
  description: SHOWA link-type monoshock, no coordinates).
- Aftermarket: Adrenaline Engineering, Vance & Hines, Soupy's,
  Gears Racing — adjustable links without OEM geometry disclosure.
- Gixxer.com forum threads — torque specs only.

Result: placeholder retained.

## Aprilia RS 660 Factory 2025

Sources tried:
- Aprilia RS 660 LE technical specifications PDF.
- HSBK Racing parts catalogue, AF1 Racing.
- Dave Moss Tuning setup guide, ApriliaForum.
- ProMechA "Motorcycle Leverage and Linkages" article.

Important finding: **the RS 660 uses a cantilever rear suspension with
the shock mounted directly to the swingarm — there is no rocker /
drag-link 4-bar linkage at all.** A search hit reports an "initial
lever ratio of 2.66:1" with dimensions 545 mm, 275 mm, 240 mm, 385 mm,
309 mm but cannot tell us where on the bike those measurements map to,
and importantly the topology is fundamentally different from the 4-bar
the closure kernel solves.

This means even if R7 and GSX-8R coords were sourced, the RS 660
would still need a different model (cantilever swingarm with an
effective lever-arm geometry, not a 4-bar closure). Documenting as
known limitation for Phase D / later validation work.

Result: placeholder retained; needs structural follow-up beyond mere
data sourcing.

## Search budget used

Three WebSearch queries (well under the 10-query bound). Further
queries unlikely to surface OEM linkage geometry — manufacturers
typically publish only spring rates and travel; the geometry is
distributed only in service manuals which are paywalled and hand-drawn
rather than digitized as coordinates.

## Recommendation for downstream phases

1. Keep the 4-bar closure kernel and its synthetic-geometry tests.
2. Skip numeric pin tests for placeholder bikes (already wired in
   tests via `hasRealCoords()` guard).
3. If real linkage validation is needed, the realistic path is
   physical measurement of one bike (drop a plumb-bob / use a
   coordinate jig) rather than continued literature search.
4. RS 660 specifically will need a cantilever model branch — its
   `expected.MotionRatio = 2.584` cannot be reproduced by the 4-bar
   kernel even with correct numbers because the topology differs.
