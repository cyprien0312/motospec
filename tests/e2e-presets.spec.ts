import { describe, it, expect } from 'vitest'
import { PRESET_BIKES, defaultSetup } from '../src/core/presets'
import { deriveState } from '../src/core/derive'

describe('end-to-end physics smoke (all presets)', () => {
  for (const bike of PRESET_BIKES) {
    it(bike.name, () => {
      const d = deriveState(bike, defaultSetup(bike))
      // trail self-consistency vs published figure
      expect(Math.abs(d.geometry.trailMm - bike.refTrailMm)).toBeLessThanOrEqual(3)
      // stock geometry passthrough
      expect(d.geometry.rakeDeg).toBeCloseTo(bike.rakeDeg, 6)
      expect(d.geometry.wheelbaseMm).toBeCloseTo(bike.wheelbaseMm, 6)
      // anti-squat plausible
      expect(d.balance.antiSquatPct).toBeGreaterThan(50)
      expect(d.balance.antiSquatPct).toBeLessThan(200)
      // weight split with rider plausible
      expect(d.balance.weightFrontPct).toBeGreaterThan(42)
      expect(d.balance.weightFrontPct).toBeLessThan(56)
      // top gear speed plausible (km/h per 1000 rpm)
      const top = d.drivetrain.speedPer1000Rpm.at(-1)!
      expect(top).toBeGreaterThan(12)
      expect(top).toBeLessThan(26)
      // chain links near stock
      expect(Math.abs(d.drivetrain.chainLinksRequired - bike.stockChainLinks)).toBeLessThanOrEqual(6)

      // SIGN CHAIN: raising the rear must reduce rake & trail, increase anti-squat
      const up = deriveState(bike, { ...defaultSetup(bike), rearRideHeightMm: 6 })
      expect(up.geometry.rakeDeg).toBeLessThan(d.geometry.rakeDeg)
      expect(up.geometry.trailMm).toBeLessThan(d.geometry.trailMm)
      expect(up.balance.antiSquatPct).toBeGreaterThan(d.balance.antiSquatPct)

      // forks up through clamps: front lower → steeper rake, shorter wheelbase
      const fork = deriveState(bike, { ...defaultSetup(bike), forkHeightMm: 5 })
      expect(fork.geometry.rakeDeg).toBeLessThan(d.geometry.rakeDeg)
      expect(fork.geometry.wheelbaseMm).toBeLessThan(d.geometry.wheelbaseMm)

      // -1T front sprocket: shorter gearing → lower speed per rpm, more anti-squat torque-wise is dynamic — skip
      const minus1 = deriveState(bike, { ...defaultSetup(bike), frontSprocket: bike.stockFrontSprocket - 1 })
      expect(minus1.drivetrain.speedPer1000Rpm.at(-1)!).toBeLessThan(top)
    })
  }
})
