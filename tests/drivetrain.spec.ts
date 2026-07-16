import { describe, expect, it } from 'vitest'
import { chainLinks, computeDrivetrain, sprocketRadiusMm } from '../src/core/drivetrain'
import type { BikeProfile, Setup } from '../src/core/types'

// ---------------------------------------------------------------------------
// Fixtures (values only matter where the drivetrain formulas read them)
// ---------------------------------------------------------------------------

const bike: BikeProfile = {
  id: 'bike-1',
  name: 'Test 600',
  category: 'supersport',
  rakeDeg: 24,
  forkOffsetMm: 25,
  refTrailMm: 97,
  wheelbaseMm: 1375,
  swingarmLengthMm: 575,
  swingarmPivotHeightMm: 480,
  countershaftVsPivot: { dxMm: -50, dzMm: 20 },
  massKg: 194,
  weightFrontPct: 52,
  cgHeightMm: 550,
  frontTire: '120/70ZR17',
  rearTire: '190/50ZR17',
  frontWheelTravelMm: 120,
  rearWheelTravelMm: 130,
  stockFrontSpringNmm: 9.0,
  stockRearSpringNmm: 95,
  gearbox: {
    primary: 2.073,
    gears: [2.583, 2.0, 1.667, 1.444, 1.286, 1.15],
  },
  chainPitch: '520',
  stockFrontSprocket: 16,
  stockRearSprocket: 45,
  stockChainLinks: 116,
  preset: true,
}

const setup: Setup = {
  id: 'setup-1',
  bikeId: 'bike-1',
  name: 'baseline',
  notes: '',
  createdAt: '2026-06-11T00:00:00.000Z',
  forkHeightMm: 0,
  rearRideHeightMm: 0,
  chainAdjusterMm: 0,
  frontSpringNmm: 9.0,
  rearSpringNmm: 95,
  frontPreloadMm: 5,
  rearPreloadMm: 8,
  frontTire: '120/70ZR17',
  rearTire: '190/50ZR17',
  frontSprocket: 16,
  rearSprocket: 45,
  chainLinks: null,
  riderKg: 75,
}

// ---------------------------------------------------------------------------
// sprocketRadiusMm — R = p / (2·sin(π/T)), p = 15.875
// ---------------------------------------------------------------------------

describe('sprocketRadiusMm', () => {
  it('16T 520 ≈ 40.69 mm', () => {
    // 15.875 / (2·sin(π/16)) = 15.875 / (2·0.1950903) = 40.686
    expect(sprocketRadiusMm(16, '520')).toBeCloseTo(40.69, 1) // ±0.05
  })

  it('45T 520 ≈ 113.79 mm', () => {
    // 15.875 / (2·sin(π/45)) = 15.875 / (2·0.0697565) = 113.79
    expect(sprocketRadiusMm(45, '520')).toBeCloseTo(113.79, 1) // ±0.05
  })

  it('all 5/8" pitches give the same radius', () => {
    expect(sprocketRadiusMm(16, '525')).toBe(sprocketRadiusMm(16, '520'))
    expect(sprocketRadiusMm(16, '530')).toBe(sprocketRadiusMm(16, '520'))
  })

  it('rejects non-integer or tiny tooth counts', () => {
    expect(() => sprocketRadiusMm(16.5, '520')).toThrow(RangeError)
    expect(() => sprocketRadiusMm(1, '520')).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// chainLinks — L = 2C/p + (T1+T2)/2 + ((T2−T1)/2π)²·p/C, rounded UP to even
// ---------------------------------------------------------------------------

describe('chainLinks', () => {
  it('16/45 at 590 mm → 106 links', () => {
    // 2·590/15.875            = 74.3307
    // (16+45)/2               = 30.5
    // (29/2π)²·15.875/590     = 21.3028 · 0.0269068 = 0.5732
    // total                   = 105.404 → next even = 106
    expect(chainLinks(16, 45, 590, '520')).toBe(106)
  })

  it('rounds a fractional result UP to even: 103.2 → 104', () => {
    // Equal sprockets kill the third term: L = 2C/p + T.
    // C = 660.4 → 2·660.4/15.875 = 83.2; +20 = 103.2 → 104
    expect(chainLinks(20, 20, 660.4, '520')).toBe(104)
  })

  it('keeps an exact even result: exactly 104.0 stays 104', () => {
    // C = 666.75 = 42·15.875 → 2C/p = 84 exactly; +20 = 104.0 → 104
    expect(chainLinks(20, 20, 666.75, '520')).toBe(104)
  })

  it('bumps an exact odd result up to the next even: 105.0 → 106', () => {
    // C = 674.6875 = 42.5·15.875 → 2C/p = 85 exactly; +20 = 105.0 → 106
    expect(chainLinks(20, 20, 674.6875, '520')).toBe(106)
  })

  it('rejects invalid inputs', () => {
    expect(() => chainLinks(0, 45, 590, '520')).toThrow(RangeError)
    expect(() => chainLinks(16, 45.2, 590, '520')).toThrow(RangeError)
    expect(() => chainLinks(16, 45, 0, '520')).toThrow(RangeError)
    expect(() => chainLinks(16, 45, Number.NaN, '520')).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// computeDrivetrain
// ---------------------------------------------------------------------------

describe('computeDrivetrain', () => {
  const circumferenceMm = 1978 // 190/50-17
  const centreMm = 590
  const state = computeDrivetrain(bike, setup, circumferenceMm, centreMm)

  it('finalDrive = rear/front = 45/16 = 2.8125 (exact)', () => {
    expect(state.finalDrive).toBe(2.8125)
  })

  it('overall ratios = primary × gear × finalDrive, per gear', () => {
    expect(state.overallRatios).toHaveLength(6)
    // 1st: 2.073 × 2.583 × 2.8125 = 5.354559 × 2.8125 = 15.0597
    expect(state.overallRatios[0]).toBeCloseTo(15.06, 2)
    // 6th: 2.073 × 1.15 × 2.8125 = 2.38395 × 2.8125 = 6.70486
    expect(state.overallRatios[5]).toBeCloseTo(6.705, 3)
  })

  it('speed per 1000 rpm in km/h, per gear', () => {
    expect(state.speedPer1000Rpm).toHaveLength(6)
    // 1st: (1000/15.0597) × 1978 × 60 / 1e6 = 66.4024 × 0.11868 = 7.8806
    expect(state.speedPer1000Rpm[0]).toBeCloseTo(7.88, 1) // ±0.05 per spec
    expect(state.speedPer1000Rpm[0]).toBeCloseTo(7.8806, 3)
    // 6th: (1000/6.70486) × 0.11868 = 149.146 × 0.11868 = 17.7006
    expect(state.speedPer1000Rpm[5]).toBeCloseTo(17.7, 1) // ±0.05 per spec
    expect(state.speedPer1000Rpm[5]).toBeCloseTo(17.7006, 3)
  })

  it('chain links required at the supplied centre distance', () => {
    expect(state.chainLinksRequired).toBe(106) // same case as chainLinks test
  })

  it('echoes the centre distance', () => {
    expect(state.centreDistanceMm).toBe(590)
  })

  it('uses SETUP sprockets, not stock', () => {
    const geared = computeDrivetrain(
      bike,
      { ...setup, frontSprocket: 15, rearSprocket: 47 },
      circumferenceMm,
      centreMm,
    )
    expect(geared.finalDrive).toBeCloseTo(47 / 15, 10)
    // shorter gearing → lower speed per 1000 rpm in every gear
    geared.speedPer1000Rpm.forEach((v, i) => {
      const baseline = state.speedPer1000Rpm[i]
      expect(baseline).toBeDefined()
      expect(v).toBeLessThan(baseline as number)
    })
  })
})
