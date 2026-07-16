# MotoSpec

**Static motorcycle chassis setup, visualised.** Adjust fork height, ride height, sprockets, tires and springs — watch rake, trail, wheelbase, swingarm angle, anti-squat geometry and weight distribution respond live on an engineering-drawing side elevation of your bike.

Strictly static analysis: no suspension dynamics, no aerodynamics. The things you can measure and change with the bike on a stand in your garage.

> Successor to the `moto-frame-mvp` static prototype.

## What it does

- **Workbench** — interactive blueprint (SVG technical drawing) of the bike with live dimension callouts: trail bracket, wheelbase dimension line, rake arc, swingarm angle, anti-squat %, F/R weight split. Set a **baseline** setup and every change ghosts the old geometry in cyan behind the new one, with signed deltas on every metric.
- **Sag Wizard** — guided L1/L2/L3 static-sag measurement for both ends, verdicts against road/track target bands, and proportional spring-rate suggestions (the classic free-sag rule: too little free sag = spring too soft).
- **Garage** — named setups per bike, duplicate/compare/baseline/delete, JSON export/import. Six factory presets (R6, ZX-6R, S1000RR, Panigale V2, MT-09, CB650R) with self-consistent geometry.

## The maths (all in `src/core/`, unit-tested)

| Module | What it computes |
|---|---|
| `tire.ts` | Tire dimensions from spec strings (`120/70ZR17`) |
| `geometry.ts` | Rake/trail/wheelbase/pitch from fork height, ride height, tire and adjuster changes. Trail = (R·sinθ − offset)/cosθ |
| `suspension.ts` | Free/rider sag analysis, target bands, spring-rate suggestions |
| `drivetrain.ts` | Final drive, overall ratios, km/h per 1000 rpm, chain-length formula (rounded to even links) |
| `balance.ts` | Weight distribution with rider, combined CG, static anti-squat % (Foale chain-line construction) |
| `derive.ts` | One pure function `(bike, setup) → DerivedState` consumed by the whole UI |

Sign conventions and module contracts live in [`src/core/types.ts`](src/core/types.ts).

## Run

```bash
npm install
npm run dev        # Vite dev server on 0.0.0.0:5173
npm test           # Vitest unit tests
npm run build      # typecheck + production build
npm run preview    # serve dist/ on 0.0.0.0
```

Local-first: everything persists to `localStorage`. No backend, no accounts.

## Disclaimer

Preset bike data is approximate (published figures where available, engineering estimates elsewhere — see comments in `src/core/presets.ts`). Always verify against your service manual. Geometry math assumes rigid suspension at static lengths; it predicts *static* posture, not handling.
