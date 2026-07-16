/**
 * geometry.ts — static chassis geometry from (bike, setup).
 *
 * Coordinate frame (side view): +x forward (the bike points right), +z up.
 * Angles are DEGREES at the API boundary, radians internally.
 * Sign conventions (see types.ts):
 *   - rakeDeg measured from VERTICAL; bigger = more raked out.
 *   - forkHeightMm > 0 = fork tubes raised up through the clamps = front LOWER.
 *   - rearRideHeightMm > 0 = rear RAISED.
 *   - chainAdjusterMm > 0 = rear axle pulled BACK = longer wheelbase.
 *   - pitchDeg > 0 = nose DOWN (rake gets steeper, i.e. smaller).
 *
 * Sanity chain that must always hold: raising the rear (or pulling the forks
 * up through the clamps) DECREASES rake and trail.
 */
import type { BikeProfile, GeometryState, Setup } from './types'
import { tireDims } from './tire'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/** Clamp into asin's domain so degenerate inputs can't produce NaN. */
function clampUnit(x: number): number {
  return Math.min(1, Math.max(-1, x))
}

export function computeGeometry(bike: BikeProfile, setup: Setup): GeometryState {
  const rakeRefRad = bike.rakeDeg * DEG_TO_RAD

  // Tire radii: reference fitment (bike profile) vs what's mounted now (setup).
  const frontRadiusRef = tireDims(bike.frontTire).radiusMm
  const rearRadiusRef = tireDims(bike.rearTire).radiusMm
  const frontRadiusNow = tireDims(setup.frontTire).radiusMm
  const rearRadiusNow = tireDims(setup.rearTire).radiusMm

  // ── 1. Tire radius deltas vs the reference fitment ────────────────────────
  const dRf = frontRadiusNow - frontRadiusRef
  const dRr = rearRadiusNow - rearRadiusRef

  // ── 2. Axle height deltas (how much each end of the chassis moved in z) ───
  // Front: a taller tire raises the front; sliding the tubes UP through the
  // clamps (forkHeightMm > 0) drops the chassis along the steering axis, whose
  // vertical component is cos(rake).
  const dFront = dRf - setup.forkHeightMm * Math.cos(rakeRefRad)
  // Rear: taller tire and/or ride-height adjuster both raise the rear.
  const dRear = dRr + setup.rearRideHeightMm

  // ── 3. Chassis pitch ───────────────────────────────────────────────────────
  // Rear up / front down rotates the chassis nose-down: positive pitch.
  const pitchRad = Math.atan((dRear - dFront) / bike.wheelbaseMm)
  const pitchDeg = pitchRad * RAD_TO_DEG

  // ── 4. New rake ────────────────────────────────────────────────────────────
  // Nose down (positive pitch) steepens the head angle ⇒ rake DECREASES.
  // Therefore raising the rear must reduce rake (tested).
  const rakeDeg = bike.rakeDeg - pitchDeg
  const rakeRad = rakeDeg * DEG_TO_RAD

  // ── 5. Trail ───────────────────────────────────────────────────────────────
  // Ground trail with the NEW rake and the CURRENT front tire radius R:
  //   trail = (R·sinθ − offset) / cosθ
  // Sanity: R = 300, θ = 24°, offset = 30 → 100.7 mm.
  const trailMm =
    (frontRadiusNow * Math.sin(rakeRad) - bike.forkOffsetMm) / Math.cos(rakeRad)

  // ── 6. Swingarm angle ──────────────────────────────────────────────────────
  // Positive when the rear axle sits BELOW the pivot:
  //   sin(arm) = (pivot height − rear axle height) / swingarm length
  // Reference: pivot at bike.swingarmPivotHeightMm, axle at rear ref radius.
  const L = bike.swingarmLengthMm
  const armRefRad = Math.asin(
    clampUnit((bike.swingarmPivotHeightMm - rearRadiusRef) / L),
  )
  // Static approximation: the pivot rides with the rear of the chassis, so the
  // current pivot height ≈ reference pivot height + rear axle height delta.
  // (Strictly the pivot moves a bit less than the axle; good enough for a
  // static comparison tool.)
  const pivotZ = bike.swingarmPivotHeightMm + dRear
  const armNowRad = Math.asin(clampUnit((pivotZ - rearRadiusNow) / L))

  // ── 7. Wheelbase ───────────────────────────────────────────────────────────
  //   ref
  //   + chain adjusters (axle straight back)
  //   − fork-height horizontal component (tubes up = axle pulled back/up along
  //     the steering axis; its horizontal component sin(rakeRef) SHORTENS wb)
  //   + swingarm rotation: the axle's horizontal reach is L·cos(arm), so the
  //     change in arm angle changes wb by L·(cos(armNow) − cos(armRef)).
  const wheelbaseMm =
    bike.wheelbaseMm +
    setup.chainAdjusterMm -
    setup.forkHeightMm * Math.sin(rakeRefRad) +
    L * (Math.cos(armNowRad) - Math.cos(armRefRad))

  return {
    rakeDeg,
    trailMm,
    wheelbaseMm,
    pitchDeg,
    frontTireRadiusMm: frontRadiusNow,
    rearTireRadiusMm: rearRadiusNow,
    swingarmAngleDeg: armNowRad * RAD_TO_DEG,
    frontRideDeltaMm: dFront,
    rearRideDeltaMm: dRear,
  }
}
