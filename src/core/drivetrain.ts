/**
 * Drivetrain calculations: sprocket geometry, chain length, gearing & speeds.
 *
 * Pure functions, no I/O. All lengths in mm, speeds in km/h.
 * See src/core/types.ts for the binding module contract.
 */

import type { BikeProfile, ChainPitch, DrivetrainState, Setup } from './types'
import { CHAIN_PITCH_MM } from './types'

/**
 * All supported pitches (520 / 525 / 530) share the same 5/8" = 15.875 mm
 * link pitch — they differ only in roller width. Kept as a lookup so a
 * future non-5/8" pitch slots in without touching call sites.
 */
const PITCH_MM: Record<ChainPitch, number> = {
  '520': CHAIN_PITCH_MM,
  '525': CHAIN_PITCH_MM,
  '530': CHAIN_PITCH_MM,
}

/** Tolerance for "exactly on an even link count" before rounding up. */
const LINK_EPSILON = 1e-9

/**
 * Pitch-circle radius of a sprocket, mm.
 *
 *   R = p / (2 · sin(π / T))
 */
export function sprocketRadiusMm(teeth: number, pitch: ChainPitch): number {
  if (!Number.isInteger(teeth) || teeth < 2) {
    throw new RangeError(`sprocketRadiusMm: teeth must be an integer ≥ 2, got ${teeth}`)
  }
  const p = PITCH_MM[pitch]
  return p / (2 * Math.sin(Math.PI / teeth))
}

/**
 * Chain length in links for two sprockets at a given centre distance,
 * using the standard chain-length formula:
 *
 *   L = 2C/p + (T1 + T2)/2 + ((T2 − T1) / 2π)² · p / C
 *
 * rounded UP to the nearest EVEN integer (chains join in full inner+outer
 * pairs). A value already exactly on an even integer is kept as-is.
 */
export function chainLinks(
  frontT: number,
  rearT: number,
  centreMm: number,
  pitch: ChainPitch,
): number {
  if (!Number.isInteger(frontT) || frontT < 2 || !Number.isInteger(rearT) || rearT < 2) {
    throw new RangeError(`chainLinks: sprocket teeth must be integers ≥ 2, got ${frontT}/${rearT}`)
  }
  if (!Number.isFinite(centreMm) || centreMm <= 0) {
    throw new RangeError(`chainLinks: centre distance must be a positive number, got ${centreMm}`)
  }
  const p = PITCH_MM[pitch]
  const exact =
    (2 * centreMm) / p +
    (frontT + rearT) / 2 +
    ((rearT - frontT) / (2 * Math.PI)) ** 2 * (p / centreMm)
  // Round up to the nearest even integer; epsilon guards float noise so an
  // exact even result (e.g. 104.0) does not get bumped to 106.
  return Math.ceil((exact - LINK_EPSILON) / 2) * 2
}

/**
 * Full drivetrain state for a bike + setup at the current chassis geometry.
 *
 * - finalDrive          = rear / front sprocket (setup values)
 * - overallRatios[i]    = primary × gears[i] × finalDrive
 * - speedPer1000Rpm[i]  = (1000 / overallRatios[i]) · circumference · 60 / 1e6  [km/h]
 * - chainLinksRequired  = chainLinks(...) at the supplied centre distance
 */
export function computeDrivetrain(
  bike: BikeProfile,
  setup: Setup,
  rearTireCircumferenceMm: number,
  centreDistanceMm: number,
): DrivetrainState {
  const finalDrive = setup.rearSprocket / setup.frontSprocket
  const { primary, gears } = bike.gearbox

  const overallRatios = gears.map((gear) => primary * gear * finalDrive)
  const speedPer1000Rpm = overallRatios.map(
    (ratio) => ((1000 / ratio) * rearTireCircumferenceMm * 60) / 1e6,
  )

  return {
    finalDrive,
    overallRatios,
    speedPer1000Rpm,
    chainLinksRequired: chainLinks(
      setup.frontSprocket,
      setup.rearSprocket,
      centreDistanceMm,
      bike.chainPitch,
    ),
    centreDistanceMm,
  }
}
