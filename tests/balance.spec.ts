/**
 * Vitest spec for src/core/balance.ts (node env).
 *
 * The sibling modules ./tire and ./drivetrain are mocked with the exact
 * contract formulas from types.ts so this spec is hermetic — it tests
 * computeBalance alone, against values computed BY HAND below.
 *
 * ── Hand computation, fixture sportbike ─────────────────────────────────────
 * wb 1375, bias 52 % front, bike 190 kg @ CG 600 mm, rider 75 kg.
 *   xBike  = 1375·(1−0.52)        = 660 mm behind front axle
 *   xRider = 0.62·1375            = 852.5 mm behind front axle
 *   total  = 190 + 75             = 265 kg
 *   xCg    = (190·660 + 75·852.5)/265   = 189 337.5/265 = 714.48113 mm
 *   zCg    = (190·600 + 75·950)/265     = 185 250/265   = 699.05660 mm
 *   front  = 265·(1375 − 714.48113)/1375
 *          = (190·715 + 75·522.5)/1375  = 175 037.5/1375 = 127.30 kg
 *   rear   = 265 − 127.30 = 137.70 kg   → front % = 48.0377 %
 *
 * Anti-squat (origin rear contact patch, +x forward, +z up), arm angle 12°:
 *   Rr(180/55-17) = 17·25.4/2 + 180·0.55 = 215.9 + 99 = 314.9
 *   A = (0, 314.9)
 *   P = (580·cos12°, 314.9 + 580·sin12°) = (567.3256, 435.4888)
 *   S = P + (60, 20) = (627.3256, 455.4888)
 *   rF(16T, 520) = 15.875/(2·sin(π/16)) = 40.6863
 *   rR(45T, 520) = 15.875/(2·sin(π/45)) = 113.7887
 *   chain top run: (627.3256, 496.1751) → (0, 428.6888), slope 0.107578
 *   swingarm line: z = 314.9 + 0.212557·x
 *   intersection I ≈ (1083.92, 545.29)  → tan σ = 0.503076
 *   tan τ = 699.05660/1375 = 0.508405
 *   anti-squat = 100·0.503076/0.508405 ≈ 98.95 %
 * ────────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it, vi } from 'vitest'
import type { BikeProfile, GeometryState, Setup } from '@/core/types'

vi.mock('@/core/tire', () => ({
  // Contract: radiusMm = rimInch·25.4/2 + widthMm·aspectPct/100
  tireDims: (spec: string) => {
    const m = /^(\d+)\/(\d+)[A-Za-z]*(\d+)$/.exec(spec)
    if (!m || !m[1] || !m[2] || !m[3]) throw new Error(`unparseable tire spec: ${spec}`)
    const radiusMm = (Number(m[3]) * 25.4) / 2 + (Number(m[1]) * Number(m[2])) / 100
    return { radiusMm, diameterMm: 2 * radiusMm, circumferenceMm: 2 * Math.PI * radiusMm }
  },
}))

vi.mock('@/core/drivetrain', () => ({
  // Contract: R = p/(2·sin(π/T)), p = 15.875 for all supported pitches
  sprocketRadiusMm: (teeth: number, _pitch: string) => 15.875 / (2 * Math.sin(Math.PI / teeth)),
}))

import { computeBalance, RIDER_CG_HEIGHT_MM, RIDER_CG_X_FRACTION } from '@/core/balance'

function makeBike(overrides: Partial<BikeProfile> = {}): BikeProfile {
  return {
    id: 'fixture-sportbike',
    name: 'Fixture Sportbike',
    category: 'supersport',
    rakeDeg: 23.5,
    forkOffsetMm: 32,
    refTrailMm: 98,
    wheelbaseMm: 1375,
    swingarmLengthMm: 580,
    swingarmPivotHeightMm: 435,
    countershaftVsPivot: { dxMm: 60, dzMm: 20 },
    massKg: 190,
    weightFrontPct: 52,
    cgHeightMm: 600,
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontWheelTravelMm: 120,
    rearWheelTravelMm: 130,
    stockFrontSpringNmm: 9.5,
    stockRearSpringNmm: 95,
    gearbox: { primary: 2.073, gears: [2.583, 2.0, 1.667, 1.444, 1.286, 1.15] },
    chainPitch: '520',
    stockFrontSprocket: 16,
    stockRearSprocket: 45,
    stockChainLinks: 116,
    ...overrides,
  }
}

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'fixture-setup',
    bikeId: 'fixture-sportbike',
    name: 'baseline',
    notes: '',
    createdAt: '2026-06-11T00:00:00.000Z',
    forkHeightMm: 0,
    rearRideHeightMm: 0,
    chainAdjusterMm: 0,
    frontSpringNmm: 9.5,
    rearSpringNmm: 95,
    frontPreloadMm: 5,
    rearPreloadMm: 8,
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontSprocket: 16,
    rearSprocket: 45,
    chainLinks: null,
    riderKg: 75,
  ...overrides,
  }
}

function makeGeom(overrides: Partial<GeometryState> = {}): GeometryState {
  return {
    rakeDeg: 23.5,
    trailMm: 98,
    wheelbaseMm: 1375,
    pitchDeg: 0,
    frontTireRadiusMm: 299.9,
    rearTireRadiusMm: 314.9,
    swingarmAngleDeg: 12,
    frontRideDeltaMm: 0,
    rearRideDeltaMm: 0,
    ...overrides,
  }
}

describe('rider model constants', () => {
  it('exports the documented rider CG assumptions', () => {
    expect(RIDER_CG_X_FRACTION).toBe(0.62)
    expect(RIDER_CG_HEIGHT_MM).toBe(950)
  })
})

describe('computeBalance — weight distribution', () => {
  const b = computeBalance(makeBike(), makeSetup(), makeGeom())

  it('front + rear loads sum to the total mass', () => {
    expect(b.totalKg).toBe(265)
    expect(b.frontLoadKg + b.rearLoadKg).toBeCloseTo(265, 2)
    expect(b.weightFrontPct + b.weightRearPct).toBeCloseTo(100, 6)
  })

  it('matches the hand-computed axle loads', () => {
    // (190·715 + 75·522.5)/1375 = 127.30 kg front
    expect(b.frontLoadKg).toBeCloseTo(127.3, 2)
    expect(b.rearLoadKg).toBeCloseTo(137.7, 2)
    expect(b.weightFrontPct).toBeCloseTo(48.0377, 3)
  })

  it('with-rider front bias lands between 47 and 53 %', () => {
    expect(b.weightFrontPct).toBeGreaterThan(47)
    expect(b.weightFrontPct).toBeLessThan(53)
  })

  it('combined CG matches hand computation and sits between bike and rider CG', () => {
    expect(b.cgHeightMm).toBeCloseTo(699.0566, 3) // 185250/265
    expect(b.cgHeightMm).toBeGreaterThan(600) // bike CG
    expect(b.cgHeightMm).toBeLessThan(950) // rider CG
    expect(b.cgBehindFrontAxleMm).toBeCloseTo(714.4811, 3) // 189337.5/265
  })

  it('a heavier rider shifts weight rearward', () => {
    const heavy = computeBalance(makeBike(), makeSetup({ riderKg: 95 }), makeGeom())
    expect(heavy.weightFrontPct).toBeLessThan(b.weightFrontPct)
    // (190·715 + 95·522.5)/1375 = 134.90 kg front of 285 kg → 47.3333 %
    expect(heavy.frontLoadKg).toBeCloseTo(134.9, 2)
    expect(heavy.weightFrontPct).toBeCloseTo(47.3333, 3)
  })
})

describe('computeBalance — anti-squat', () => {
  it('matches the hand-computed Foale construction (≈ 98.95 %)', () => {
    const b = computeBalance(makeBike(), makeSetup(), makeGeom())
    expect(b.antiSquatPct).toBeGreaterThan(50)
    expect(b.antiSquatPct).toBeLessThan(200)
    expect(Math.abs(b.antiSquatPct - 98.95)).toBeLessThan(0.5)
  })

  it('increasing swingarm angle increases anti-squat (12° → 14°)', () => {
    const at12 = computeBalance(makeBike(), makeSetup(), makeGeom({ swingarmAngleDeg: 12 }))
    const at13 = computeBalance(makeBike(), makeSetup(), makeGeom({ swingarmAngleDeg: 13 }))
    const at14 = computeBalance(makeBike(), makeSetup(), makeGeom({ swingarmAngleDeg: 14 }))
    expect(at13.antiSquatPct).toBeGreaterThan(at12.antiSquatPct)
    expect(at14.antiSquatPct).toBeGreaterThan(at13.antiSquatPct)
  })

  it('returns 0 when chain run and swingarm line are parallel', () => {
    // Arm angle 0 → swingarm line horizontal at z = Rr. Putting the
    // countershaft exactly (rRear − rFront) above the pivot makes the chain
    // top run horizontal too → no intersection.
    const rF = 15.875 / (2 * Math.sin(Math.PI / 16))
    const rR = 15.875 / (2 * Math.sin(Math.PI / 45))
    const bike = makeBike({ countershaftVsPivot: { dxMm: 60, dzMm: rR - rF } })
    const b = computeBalance(bike, makeSetup(), makeGeom({ swingarmAngleDeg: 0 }))
    expect(b.antiSquatPct).toBeCloseTo(0, 2)
  })

  it('clamps absurd geometry to 400 % for display sanity', () => {
    // No rider, bike CG 10 mm off the deck → tan τ = 10/1375 → raw AS ≈ 6900 %.
    const bike = makeBike({ cgHeightMm: 10 })
    const b = computeBalance(bike, makeSetup({ riderKg: 0 }), makeGeom())
    expect(b.antiSquatPct).toBe(400)
  })
})
