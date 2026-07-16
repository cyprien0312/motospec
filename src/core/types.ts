/**
 * MotoSpec core domain contract.
 *
 * Everything in this file is the single source of truth for module APIs.
 * All lengths are millimetres, all masses kilograms, all angles DEGREES
 * unless a name says otherwise. Static analysis only — no dynamics, no aero.
 *
 * SIGN CONVENTIONS (side view, bike pointing right/forward = +x, up = +z):
 * - rakeDeg: steering-axis angle measured from VERTICAL. Bigger = more raked out.
 * - forkHeightMm (setup): how far the fork tubes protrude ABOVE the top clamp.
 *   Positive = tubes raised = front end LOWER. 0 = flush reference.
 * - rearRideHeightMm (setup): change of rear axle-to-chassis height vs stock.
 *   Positive = rear RAISED.
 * - chainAdjusterMm (setup): rear axle position in the adjusters vs stock.
 *   Positive = axle pulled BACK (longer wheelbase).
 * - Pitch: positive pitch = nose DOWN (rake gets steeper/smaller).
 */

// ---------------------------------------------------------------------------
// Tire
// ---------------------------------------------------------------------------

export interface TireSpec {
  /** e.g. "120/70ZR17" — width mm */
  widthMm: number
  /** aspect ratio percent, e.g. 70 */
  aspectPct: number
  /** rim diameter in inches, e.g. 17 */
  rimInch: number
}

export interface TireDims {
  /** unloaded radius, mm = rimInch*25.4/2 + widthMm*aspectPct/100 */
  radiusMm: number
  diameterMm: number
  circumferenceMm: number
}

// ---------------------------------------------------------------------------
// Bike profile (the machine as it left the factory — the reference state)
// ---------------------------------------------------------------------------

export type ChainPitch = '520' | '525' | '530' // all 5/8" = 15.875 mm pitch

export interface GearboxSpec {
  /** primary reduction ratio (crank:clutch), e.g. 2.073 */
  primary: number
  /** internal ratios, 1st..Nth, e.g. [2.583, 2.0, ...] */
  gears: number[]
}

export interface BikeProfile {
  id: string
  name: string
  category: 'supersport' | 'superbike' | 'naked' | 'adv' | 'custom'
  /** steering head angle from vertical at reference ride height */
  rakeDeg: number
  /** triple-clamp offset: perpendicular distance axle ↔ steering axis */
  forkOffsetMm: number
  /** published reference trail (for cross-checking, not used in calc) */
  refTrailMm: number
  wheelbaseMm: number
  /** swingarm pivot → rear axle */
  swingarmLengthMm: number
  /** swingarm pivot height above ground at reference */
  swingarmPivotHeightMm: number
  /** countershaft (front) sprocket centre, relative to swingarm pivot */
  countershaftVsPivot: { dxMm: number; dzMm: number }
  /** wet mass, no rider */
  massKg: number
  /** static front weight bias at reference, percent (0..100) */
  weightFrontPct: number
  /** combined CG height estimate above ground (bike alone) */
  cgHeightMm: number
  frontTire: string
  rearTire: string
  frontWheelTravelMm: number
  rearWheelTravelMm: number
  /** stock spring rates, N/mm (fork = per leg) */
  stockFrontSpringNmm: number
  stockRearSpringNmm: number
  gearbox: GearboxSpec
  chainPitch: ChainPitch
  stockFrontSprocket: number
  stockRearSprocket: number
  stockChainLinks: number
  /** true for factory presets that ship with the app (not user-editable) */
  preset?: boolean
}

// ---------------------------------------------------------------------------
// Setup (one named combination of adjustments for a bike)
// ---------------------------------------------------------------------------

export interface SagMeasurement {
  /** L1: wheel fully extended (bike on stand), mm */
  l1: number
  /** L2: bike under its own weight, mm */
  l2: number
  /** L3: bike with rider in position, mm */
  l3: number
}

export interface Setup {
  id: string
  bikeId: string
  name: string
  notes: string
  createdAt: string // ISO date
  // --- chassis ---
  forkHeightMm: number
  rearRideHeightMm: number
  chainAdjusterMm: number
  // --- suspension ---
  frontSpringNmm: number
  rearSpringNmm: number
  frontPreloadMm: number
  rearPreloadMm: number
  /** measured sag, optional */
  frontSag?: SagMeasurement
  rearSag?: SagMeasurement
  // --- rolling stock ---
  frontTire: string
  rearTire: string
  // --- drivetrain ---
  frontSprocket: number
  rearSprocket: number
  /** chain length in links; null = auto (computed) */
  chainLinks: number | null
  // --- rider ---
  riderKg: number
}

// ---------------------------------------------------------------------------
// Derived state (what the whole app displays)
// ---------------------------------------------------------------------------

export type SagVerdict = 'ok' | 'too-soft' | 'too-stiff' | 'low' | 'high' | 'n/a'

export interface SagAnalysis {
  /** L1-L2 */
  freeSagMm: number | null
  /** L1-L3 */
  riderSagMm: number | null
  riderSagPctOfTravel: number | null
  /** target band for rider sag, mm */
  targetRiderSagMm: [number, number]
  /** target band for free sag, mm */
  targetFreeSagMm: [number, number]
  /** verdict on rider sag vs target */
  riderSagVerdict: SagVerdict
  /** spring verdict from free sag rule (too much free sag = too stiff) */
  springVerdict: SagVerdict
  /** suggested spring rate (proportional model), N/mm, null if no measurement */
  suggestedSpringNmm: number | null
}

export interface GeometryState {
  rakeDeg: number
  trailMm: number
  wheelbaseMm: number
  /** chassis pitch vs reference; positive = nose down */
  pitchDeg: number
  frontTireRadiusMm: number
  rearTireRadiusMm: number
  /** swingarm angle from horizontal; positive = axle below pivot */
  swingarmAngleDeg: number
  /** front axle height change vs reference (tires + forks), mm */
  frontRideDeltaMm: number
  /** rear axle height change vs reference (tires + ride height), mm */
  rearRideDeltaMm: number
}

export interface BalanceState {
  /** with rider aboard */
  weightFrontPct: number
  weightRearPct: number
  frontLoadKg: number
  rearLoadKg: number
  totalKg: number
  /** combined CG (bike+rider) height above ground */
  cgHeightMm: number
  /** combined CG horizontal distance behind front axle */
  cgBehindFrontAxleMm: number
  /** static anti-squat geometry, percent (chain-line construction) */
  antiSquatPct: number
}

export interface DrivetrainState {
  finalDrive: number
  /** overall ratio per gear (primary × gear × final) */
  overallRatios: number[]
  /** km/h per 1000 rpm, per gear */
  speedPer1000Rpm: number[]
  /** chain links required for current sprockets at current centre distance */
  chainLinksRequired: number
  /** sprocket-centre to rear-axle distance used, mm */
  centreDistanceMm: number
}

export interface DerivedState {
  geometry: GeometryState
  balance: BalanceState
  drivetrain: DrivetrainState
  frontSag: SagAnalysis
  rearSag: SagAnalysis
  /** human-readable cautions, e.g. "trail below 85 mm — twitchy" */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Module contracts (implemented in sibling files)
// ---------------------------------------------------------------------------
//
// src/core/tire.ts
//   parseTire(spec: string): TireSpec            — throws on unparseable
//   tireDims(spec: string): TireDims
//
// src/core/geometry.ts
//   computeGeometry(bike: BikeProfile, setup: Setup): GeometryState
//     Trail formula (rake θ from vertical, R = front tire radius, o = offset):
//       trail = (R·sinθ − o) / cosθ
//     Pitch from ride-height deltas: pitch = atan((Δfront − Δrear)/wheelbase)
//       where Δfront = ΔR_front − forkHeightMm·cosθ
//             Δrear  = ΔR_rear + rearRideHeightMm
//       (positive pitch = nose down; new rake = ref rake + pitch... careful:
//        nose down ⇒ rake DECREASES ⇒ rakeDeg = bike.rakeDeg + pitchDeg where
//        pitchDeg = atan((Δrear − Δfront)/wb) NEGATED — define ONE convention
//        and test it: RAISING THE REAR MUST REDUCE RAKE AND TRAIL.)
//     Wheelbase = ref + chainAdjusterMm − forkHeightMm·sinθ + swingarm-rotation
//       horizontal effect of rear ride-height change.
//
// src/core/suspension.ts
//   analyzeSag(meas: SagMeasurement|undefined, travelMm: number,
//              end: 'front'|'rear', currentSpringNmm: number): SagAnalysis
//     Targets (road/track compromise):
//       front rider sag 30–40 mm, rear rider sag 25–35 mm
//       front free sag 15–30 mm, rear free sag 5–10 mm
//     Free-sag rule: BELOW band ⇒ spring too SOFT (excess preload masking it),
//                    ABOVE band ⇒ spring too STIFF.
//     suggestedSpringNmm = current × riderSag/targetMid (proportional, linear)
//
// src/core/drivetrain.ts
//   sprocketRadiusMm(teeth: number, pitch: ChainPitch): number
//     R = p / (2·sin(π/T)), p = 15.875
//   chainLinks(frontT, rearT, centreMm, pitch): number   — standard formula,
//     L = 2C/p + (T1+T2)/2 + ((T2−T1)/(2π))²·p/C, rounded UP to even
//   computeDrivetrain(bike, setup, rearTireCircumferenceMm,
//                     centreDistanceMm): DrivetrainState
//
// src/core/balance.ts
//   computeBalance(bike, setup, geom: GeometryState): BalanceState
//     Rider modelled as point mass at 62% of wheelbase behind front axle,
//     950 mm above ground (documented assumption, constants exported).
//     Anti-squat (Foale construction, all static geometry):
//       1. chain top-run line: tangent line over front & rear sprockets
//          (approximate as line from countershaft top to rear sprocket top)
//       2. A = intersection of swingarm line (pivot→axle) with chain top run
//       3. squat line: rear contact patch → A, angle σ
//       4. 100% line: rear contact patch → point at CG height above FRONT
//          contact patch, angle τ
//       antiSquatPct = 100 · tanσ / tanτ
//
// src/core/presets.ts
//   PRESET_BIKES: BikeProfile[]  — ≥5 real bikes, values approximate from
//     published specs, each marked preset: true
//   defaultSetup(bike: BikeProfile): Setup — stock everything, rider 75 kg
//
// src/core/derive.ts
//   deriveState(bike: BikeProfile, setup: Setup): DerivedState — orchestrates
//     all of the above; pure, no I/O.
// ---------------------------------------------------------------------------

export const CHAIN_PITCH_MM = 15.875

/** ids are timestamps+random in the store; core never generates ids */
export type Id = string
