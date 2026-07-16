/**
 * deriveState — the single orchestrator the UI calls.
 * Pure function of (bike, setup); no I/O, no globals.
 */
import type { BikeProfile, DerivedState, Setup } from './types'
import { tireDims } from './tire'
import { computeGeometry } from './geometry'
import { analyzeSag } from './suspension'
import { computeDrivetrain, sprocketRadiusMm } from './drivetrain'
import { computeBalance } from './balance'

export function deriveState(bike: BikeProfile, setup: Setup): DerivedState {
  const geometry = computeGeometry(bike, setup)
  const balance = computeBalance(bike, setup, geometry)

  // Centre distance for the chain run: countershaft → rear axle, in side view.
  // The axle hangs BEHIND/below the pivot; the countershaft sits FORWARD/above
  // it (countershaftVsPivot uses the global +x forward, +z up convention —
  // see balance.ts), so both offsets ADD to the axle→shaft separation.
  const armAngleRad = (geometry.swingarmAngleDeg * Math.PI) / 180
  const axleBackMm = bike.swingarmLengthMm * Math.cos(armAngleRad) + setup.chainAdjusterMm
  const axleDropMm = bike.swingarmLengthMm * Math.sin(armAngleRad)
  const dx = axleBackMm + bike.countershaftVsPivot.dxMm
  const dz = axleDropMm + bike.countershaftVsPivot.dzMm
  const centreDistanceMm = Math.hypot(dx, dz)

  const rearTire = tireDims(setup.rearTire)
  const drivetrain = computeDrivetrain(bike, setup, rearTire.circumferenceMm, centreDistanceMm)

  const frontSag = analyzeSag(setup.frontSag, bike.frontWheelTravelMm, 'front', setup.frontSpringNmm)
  const rearSag = analyzeSag(setup.rearSag, bike.rearWheelTravelMm, 'rear', setup.rearSpringNmm)

  const warnings: string[] = []
  if (geometry.trailMm < 85) warnings.push(`Trail ${geometry.trailMm.toFixed(1)} mm is very short — expect nervous steering.`)
  if (geometry.trailMm > 120) warnings.push(`Trail ${geometry.trailMm.toFixed(1)} mm is very long — heavy turn-in.`)
  if (geometry.swingarmAngleDeg < 8) warnings.push(`Swingarm angle ${geometry.swingarmAngleDeg.toFixed(1)}° is flat — squat resistance is low.`)
  if (balance.antiSquatPct < 80) warnings.push(`Anti-squat ${balance.antiSquatPct.toFixed(0)}% — rear will squat under load.`)
  if (setup.forkHeightMm > 10) warnings.push(`Forks ${setup.forkHeightMm} mm through the clamps — check fender/radiator clearance at full compression.`)
  if (frontSag.riderSagVerdict === 'low' || frontSag.riderSagVerdict === 'high') warnings.push('Front rider sag outside target band.')
  if (rearSag.riderSagVerdict === 'low' || rearSag.riderSagVerdict === 'high') warnings.push('Rear rider sag outside target band.')

  // Chain links sanity: warn when chosen length differs from required.
  if (setup.chainLinks !== null && setup.chainLinks !== drivetrain.chainLinksRequired) {
    warnings.push(`Chain is ${setup.chainLinks} links; geometry wants ${drivetrain.chainLinksRequired}. Adjusters compensate ≈${(Math.abs(setup.chainLinks - drivetrain.chainLinksRequired) * 15.875 / 2).toFixed(1)} mm.`)
  }

  return { geometry, balance, drivetrain, frontSag, rearSag, warnings }
}

export { sprocketRadiusMm }
