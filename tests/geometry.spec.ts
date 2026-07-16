/**
 * geometry.spec.ts — hand-computed expectations for computeGeometry.
 *
 * Every expected number below is worked out by hand (arithmetic shown in
 * comments), NOT snapshotted from the implementation.
 *
 * The sibling module src/core/tire.ts may not exist yet (built in parallel),
 * so we mock it here with the exact contract formula from types.ts:
 *   radiusMm = rimInch·25.4/2 + widthMm·aspectPct/100
 */
import { describe, expect, it, vi } from 'vitest'
import type { BikeProfile, Setup, TireDims } from '../src/core/types'

vi.mock('../src/core/tire', () => ({
  tireDims: (spec: string): TireDims => {
    // Accept "120/70-17", "120/70ZR17", "180/55 R 17", etc.
    const m = /^(\d+)\/(\d+)\D*(\d+)$/.exec(spec.trim())
    const w = m?.[1]
    const a = m?.[2]
    const r = m?.[3]
    if (w === undefined || a === undefined || r === undefined) {
      throw new Error(`unparseable tire spec: ${spec}`)
    }
    const radiusMm = (Number(r) * 25.4) / 2 + (Number(w) * Number(a)) / 100
    return {
      radiusMm,
      diameterMm: radiusMm * 2,
      circumferenceMm: 2 * Math.PI * radiusMm,
    }
  },
}))

import { computeGeometry } from '../src/core/geometry'

// ---------------------------------------------------------------------------
// Fixture: a realistic supersport.
// Tire radii (mock formula):
//   front 120/70-17 → 17·25.4/2 + 120·0.70 = 215.9 + 84.0  = 299.9 mm
//   rear  180/55-17 → 215.9 + 180·0.55           = 215.9 + 99.0  = 314.9 mm
//   tall  190/55-17 → 215.9 + 190·0.55           = 215.9 + 104.5 = 320.4 mm
// ---------------------------------------------------------------------------
const bike: BikeProfile = {
  id: 'fixture-ss',
  name: 'Fixture Supersport',
  category: 'supersport',
  rakeDeg: 24,
  forkOffsetMm: 30,
  refTrailMm: 100.7,
  wheelbaseMm: 1375,
  swingarmLengthMm: 580,
  swingarmPivotHeightMm: 480,
  countershaftVsPivot: { dxMm: -50, dzMm: 20 },
  massKg: 195,
  weightFrontPct: 51,
  cgHeightMm: 550,
  frontTire: '120/70-17',
  rearTire: '180/55-17',
  frontWheelTravelMm: 120,
  rearWheelTravelMm: 130,
  stockFrontSpringNmm: 9.5,
  stockRearSpringNmm: 95,
  gearbox: { primary: 2.073, gears: [2.583, 2.0, 1.667, 1.444, 1.286, 1.15] },
  chainPitch: '525',
  stockFrontSprocket: 16,
  stockRearSprocket: 46,
  stockChainLinks: 116,
  preset: true,
}

function stockSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'fixture-setup',
    bikeId: bike.id,
    name: 'stock',
    notes: '',
    createdAt: '2026-06-11T00:00:00.000Z',
    forkHeightMm: 0,
    rearRideHeightMm: 0,
    chainAdjusterMm: 0,
    frontSpringNmm: bike.stockFrontSpringNmm,
    rearSpringNmm: bike.stockRearSpringNmm,
    frontPreloadMm: 0,
    rearPreloadMm: 0,
    frontTire: bike.frontTire,
    rearTire: bike.rearTire,
    frontSprocket: bike.stockFrontSprocket,
    rearSprocket: bike.stockRearSprocket,
    chainLinks: null,
    riderKg: 75,
    ...overrides,
  }
}

describe('computeGeometry — stock setup reproduces the reference', () => {
  const g = computeGeometry(bike, stockSetup())

  it('rake equals the bike reference exactly', () => {
    // No deltas anywhere ⇒ pitch = atan(0/1375) = 0 ⇒ rake = 24 − 0 = 24.
    expect(g.rakeDeg).toBe(bike.rakeDeg)
    expect(g.pitchDeg).toBe(0)
  })

  it('wheelbase equals the bike reference exactly', () => {
    // adjusters 0, fork term 0, armNow ≡ armRef ⇒ swingarm term exactly 0.
    expect(g.wheelbaseMm).toBe(bike.wheelbaseMm)
  })

  it('trail matches the hand-computed value', () => {
    // trail = (R·sin24° − 30)/cos24°, R = 299.9
    //   sin24° = 0.406737, cos24° = 0.913545
    //   = (299.9·0.406737 − 30)/0.913545 = (121.980 − 30)/0.913545
    //   = 91.980/0.913545 = 100.69 mm
    expect(Math.abs(g.trailMm - 100.69)).toBeLessThan(6) // task tolerance
    expect(g.trailMm).toBeCloseTo(100.69, 1) // and the tight hand-check
  })

  it('swingarm angle matches the hand-computed value (axle below pivot)', () => {
    // sin(arm) = (480 − 314.9)/580 = 165.1/580 = 0.284655
    // arm = asin(0.284655) = 0.288646 rad = 16.538°
    expect(g.swingarmAngleDeg).toBeCloseTo(16.538, 2)
    expect(g.swingarmAngleDeg).toBeGreaterThan(0)
  })

  it('reports current tire radii and zero ride deltas', () => {
    expect(g.frontTireRadiusMm).toBeCloseTo(299.9, 6)
    expect(g.rearTireRadiusMm).toBeCloseTo(314.9, 6)
    expect(g.frontRideDeltaMm).toBe(0)
    expect(g.rearRideDeltaMm).toBe(0)
  })
})

describe('computeGeometry — rear ride height +6 mm', () => {
  const stock = computeGeometry(bike, stockSetup())
  const g = computeGeometry(bike, stockSetup({ rearRideHeightMm: 6 }))

  it('pitches the nose down ≈0.25° and reduces rake by the same', () => {
    // pitch = atan(6/1375) = atan(0.0043636) = 0.0043636 rad = 0.2500°
    expect(g.pitchDeg).toBeCloseTo(0.25, 3)
    // rake = 24 − 0.25 = 23.75 — RAISING THE REAR MUST REDUCE RAKE.
    expect(g.rakeDeg).toBeCloseTo(23.75, 3)
    expect(g.rakeDeg).toBeLessThan(stock.rakeDeg)
  })

  it('reduces trail', () => {
    expect(g.trailMm).toBeLessThan(stock.trailMm)
  })

  it('steepens the swingarm and shortens the wheelbase a touch', () => {
    // armNow: sin = (480+6−314.9)/580 = 171.1/580 = 0.295 → asin = 17.157°
    expect(g.swingarmAngleDeg).toBeCloseTo(17.157, 2)
    // Δwb = 580·(cos17.157° − cos16.538°) = 580·(0.955497 − 0.958630) = −1.82
    expect(g.wheelbaseMm).toBeCloseTo(1375 - 1.82, 1)
    expect(g.rearRideDeltaMm).toBe(6)
  })
})

describe('computeGeometry — fork height +5 mm (tubes up = front lower)', () => {
  const stock = computeGeometry(bike, stockSetup())
  const g = computeGeometry(bike, stockSetup({ forkHeightMm: 5 }))

  it('lowers the front and reduces rake', () => {
    // dFront = −5·cos24° = −4.5677 mm
    expect(g.frontRideDeltaMm).toBeCloseTo(-4.568, 2)
    // pitch = atan((0 − (−4.5677))/1375) = atan(0.0033220) = 0.19033°
    expect(g.pitchDeg).toBeCloseTo(0.1903, 3)
    // rake = 24 − 0.19033 = 23.8097
    expect(g.rakeDeg).toBeCloseTo(23.8097, 3)
    expect(g.rakeDeg).toBeLessThan(stock.rakeDeg)
  })

  it('reduces trail', () => {
    expect(g.trailMm).toBeLessThan(stock.trailMm)
  })

  it('shortens the wheelbase slightly', () => {
    // wb = 1375 − 5·sin24° = 1375 − 2.0337 = 1372.97 (swingarm untouched)
    expect(g.wheelbaseMm).toBeCloseTo(1372.97, 1)
    expect(g.wheelbaseMm).toBeLessThan(stock.wheelbaseMm)
  })
})

describe('computeGeometry — taller rear tire 190/55-17', () => {
  const stock = computeGeometry(bike, stockSetup())
  const g = computeGeometry(bike, stockSetup({ rearTire: '190/55-17' }))

  it('acts like raising the rear: rake decreases vs stock', () => {
    // dRr = 320.4 − 314.9 = 5.5 mm ⇒ pitch = atan(5.5/1375) = 0.22918°
    // rake = 24 − 0.22918 = 23.7708
    expect(g.pitchDeg).toBeCloseTo(0.2292, 3)
    expect(g.rakeDeg).toBeCloseTo(23.7708, 3)
    expect(g.rakeDeg).toBeLessThan(stock.rakeDeg)
    expect(g.rearTireRadiusMm).toBeCloseTo(320.4, 6)
    expect(g.rearRideDeltaMm).toBeCloseTo(5.5, 6)
  })

  it('leaves the swingarm angle unchanged (pivot rises with the tire)', () => {
    // pivotZ − Rr_now = (480 + 5.5) − 320.4 = 165.1 — identical to reference,
    // because the pivot is modelled as riding with the rear axle delta.
    expect(g.swingarmAngleDeg).toBeCloseTo(stock.swingarmAngleDeg, 6)
    expect(g.wheelbaseMm).toBeCloseTo(bike.wheelbaseMm, 6)
  })
})

describe('computeGeometry — chain adjuster +4 mm', () => {
  const stock = computeGeometry(bike, stockSetup())
  const g = computeGeometry(bike, stockSetup({ chainAdjusterMm: 4 }))

  it('adds exactly 4 mm of wheelbase', () => {
    expect(g.wheelbaseMm).toBe(bike.wheelbaseMm + 4)
  })

  it('leaves rake, trail, pitch, swingarm unchanged', () => {
    expect(g.rakeDeg).toBe(stock.rakeDeg)
    expect(g.trailMm).toBe(stock.trailMm)
    expect(g.pitchDeg).toBe(0)
    expect(g.swingarmAngleDeg).toBe(stock.swingarmAngleDeg)
  })
})
