# Reference-bike chassis specs

Companion to `docs/research/linkage-coords.md`. Tracks where the
**chassis** numbers (frame geometry, mass + CG, aero share, tire) for
each reference bike come from. Numbers feed `data/chassis.json` via the
chassis catalog (Chassis Setup page → Save as Profile, or hand-edit).

All distances in mm, angles in degrees, mass in kg, ratios in [0, 1].

## Schema (one entry per `data/chassis.json` id)

```json
{
  "<bike-id>-stock": {
    "name": "<Manufacturer> <Model> (<Year>) — stock chassis",
    "source": "<service manual page X / press kit / measurement>",
    "specs": {
      "Rake_Static": 24.0,
      "WB": 1395,
      "Swingarm_Length": 580,
      "beta_static": 14,
      "Yoke_Offset": 35,
      "Fork_Position": 5,
      "Mass": 195,
      "H_CG": 630,
      "L_CG": 730,
      "front_weight_dist": 0.53,
      "rear_weight_dist": 0.47,
      "C_f_aero": 0.4,
      "C_r_aero": 0.6,
      "Rf": 308
    }
  }
}
```

## Sources to mine

In priority order:

1. **OEM service-manual frame-geometry section** (highest authority).
2. **Press-kit technical spec sheets** (rake / wheelbase / weight only).
3. **Trustworthy aftermarket reviews** (some publish CG measurements
   from instrumented testing).
4. **Direct measurement on a workshop bike** (rake/WB tape-and-plumb;
   CG via tilt-table or scales-on-incline; mass via wheel scales).

If a number isn't directly published (most CG figures aren't), document
the derivation: e.g. "front_weight_dist computed from front-wheel scale
at MFG-spec wet weight" with the citation.

## Bikes to backfill

- [ ] Yamaha YZF-R7 (2022)
- [ ] Yamaha YZF-R6 (2020)
- [ ] Suzuki GSX-8R (2024)
- [ ] Aprilia RS 660 Factory (2025)
- [ ] Honda CBR1000RR-R Fireblade SP (2024)
- [ ] Ducati Panigale V4 (2023)

When sourcing, also add the corresponding `linkage` entry in
`data/linkages.json` (Phase C task in
`docs/superpowers/plans/2026-05-06-data-table-full-parity.md`). The two
catalogs are independent but the Data Table is most useful when both
sides are populated for the same bike.
