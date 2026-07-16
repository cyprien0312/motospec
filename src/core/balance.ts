/**
 * Static weight distribution and anti-squat geometry.
 *
 * DOCUMENTED ASSUMPTIONS (all static, side-view, no dynamics):
 * - The rider is modelled as a point mass located at RIDER_CG_X_FRACTION of
 *   the wheelbase BEHIND the front axle and RIDER_CG_HEIGHT_MM above ground.
 * - The bike's own CG sits at horizontal position derived from its published
 *   static front weight bias, at bike.cgHeightMm above ground.
 * - Anti-squat uses Tony Foale's static chain-line construction. The chain
 *   top run is approximated as the line joining the topmost points of the
 *   front (countershaft) and rear sprockets — a tangent-line approximation
 *   that is accurate to well under a degree for typical sprocket sizes.
 *
 * Coordinate frame for the anti-squat construction:
 *   origin = REAR tire contact patch, +x toward the FRONT of the bike, +z up.
 */
import type { BalanceState, BikeProfile, GeometryState, Setup } from './types'
import { sprocketRadiusMm } from './drivetrain'
import { tireDims } from './tire'

/** Rider CG sits at 62% of the wheelbase behind the front axle. */
export const RIDER_CG_X_FRACTION = 0.62

/** Rider CG height above ground, mm (typical seated sportbike rider). */
export const RIDER_CG_HEIGHT_MM = 950

interface Pt {
  x: number
  z: number
}

/**
 * Static anti-squat percentage via the Foale construction.
 * Returns 0 when the swingarm line and chain top run are (near-)parallel.
 * Clamped to [-200, 400] for display sanity.
 */
function computeAntiSquatPct(
  bike: BikeProfile,
  setup: Setup,
  geom: GeometryState,
  cgHeightCombinedMm: number,
): number {
  const wb = geom.wheelbaseMm

  // 1. Rear axle, directly above the rear contact patch (origin).
  const rearRadiusMm = tireDims(setup.rearTire).radiusMm
  const axle: Pt = { x: 0, z: rearRadiusMm }

  // 2. Swingarm pivot. Positive swingarm angle = axle below pivot,
  //    so the pivot sits forward of and above the axle.
  const armRad = (geom.swingarmAngleDeg * Math.PI) / 180
  const L = bike.swingarmLengthMm
  const pivot: Pt = {
    x: L * Math.cos(armRad),
    z: rearRadiusMm + L * Math.sin(armRad),
  }

  // 3. Countershaft sprocket centre, offset from the pivot.
  const shaft: Pt = {
    x: pivot.x + bike.countershaftVsPivot.dxMm,
    z: pivot.z + bike.countershaftVsPivot.dzMm,
  }

  // 4. Sprocket pitch radii.
  const rFront = sprocketRadiusMm(setup.frontSprocket, bike.chainPitch)
  const rRear = sprocketRadiusMm(setup.rearSprocket, bike.chainPitch)

  // 5. Chain top run ≈ line through the tops of both sprockets.
  const chainA: Pt = { x: shaft.x, z: shaft.z + rFront }
  const chainB: Pt = { x: axle.x, z: axle.z + rRear }

  // 6. Intersect the swingarm line (pivot → axle) with the chain top run.
  const dArm: Pt = { x: axle.x - pivot.x, z: axle.z - pivot.z }
  const dChain: Pt = { x: chainB.x - chainA.x, z: chainB.z - chainA.z }
  const denom = dArm.x * dChain.z - dArm.z * dChain.x
  if (Math.abs(denom) < 1e-9) return 0
  const t = ((chainA.x - pivot.x) * dChain.z - (chainA.z - pivot.z) * dChain.x) / denom
  const I: Pt = { x: pivot.x + t * dArm.x, z: pivot.z + t * dArm.z }

  // 7. Squat line angle σ (rear contact → I) vs the 100% line angle τ
  //    (rear contact → combined-CG height above the FRONT contact patch).
  const sigma = Math.atan2(I.z, I.x)
  const tau = Math.atan2(cgHeightCombinedMm, wb)

  // 8. Anti-squat percentage, clamped for display sanity.
  const raw = (100 * Math.tan(sigma)) / Math.tan(tau)
  return Math.min(400, Math.max(-200, raw))
}

/**
 * Static weight split and anti-squat for the bike with rider aboard.
 */
export function computeBalance(bike: BikeProfile, setup: Setup, geom: GeometryState): BalanceState {
  const wb = geom.wheelbaseMm

  // Bike CG: horizontal position behind the front axle from the static bias.
  const xBike = wb * (1 - bike.weightFrontPct / 100)
  const zBike = bike.cgHeightMm

  // Rider point mass (documented assumption, constants above).
  const xRider = RIDER_CG_X_FRACTION * wb
  const zRider = RIDER_CG_HEIGHT_MM

  // Combined CG = mass-weighted average.
  const totalKg = bike.massKg + setup.riderKg
  const cgBehindFrontAxleMm = (bike.massKg * xBike + setup.riderKg * xRider) / totalKg
  const cgHeightMm = (bike.massKg * zBike + setup.riderKg * zRider) / totalKg

  // Static axle loads from moment balance about the rear axle.
  const frontLoadKg = (totalKg * (wb - cgBehindFrontAxleMm)) / wb
  const rearLoadKg = totalKg - frontLoadKg
  const weightFrontPct = (frontLoadKg / totalKg) * 100
  const weightRearPct = 100 - weightFrontPct

  const antiSquatPct = computeAntiSquatPct(bike, setup, geom, cgHeightMm)

  return {
    weightFrontPct,
    weightRearPct,
    frontLoadKg,
    rearLoadKg,
    totalKg,
    cgHeightMm,
    cgBehindFrontAxleMm,
    antiSquatPct,
  }
}
