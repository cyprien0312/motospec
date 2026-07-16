import { describe, expect, it } from 'vitest'
import { analyzeSag, SAG_TARGETS } from '../src/core/suspension'
import type { SagMeasurement } from '../src/core/types'

describe('SAG_TARGETS', () => {
  it('exposes the road/track compromise bands', () => {
    expect(SAG_TARGETS.front.rider).toEqual([30, 40])
    expect(SAG_TARGETS.front.free).toEqual([15, 30])
    expect(SAG_TARGETS.rear.rider).toEqual([25, 35])
    expect(SAG_TARGETS.rear.free).toEqual([5, 10])
  })
})

describe('analyzeSag — front, everything in band', () => {
  // L1 770, L2 745, L3 735, travel 120, spring 9.5 N/mm (per leg)
  // free  = 770 − 745 = 25  → in [15, 30] ⇒ spring 'ok'
  // rider = 770 − 735 = 35  → in [30, 40] ⇒ rider 'ok'
  // pct   = 35 / 120 × 100 = 29.1666…
  // mid of front rider band = (30 + 40)/2 = 35 ⇒ suggestion = 9.5 × 35/35 = 9.5
  const meas: SagMeasurement = { l1: 770, l2: 745, l3: 735 }
  const res = analyzeSag(meas, 120, 'front', 9.5)

  it('computes free and rider sag', () => {
    expect(res.freeSagMm).toBe(25)
    expect(res.riderSagMm).toBe(35)
    expect(res.riderSagPctOfTravel).toBeCloseTo(29.1666666667, 6)
  })

  it('returns ok verdicts for both', () => {
    expect(res.riderSagVerdict).toBe('ok')
    expect(res.springVerdict).toBe('ok')
  })

  it('suggests exactly the current spring when rider sag hits the band midpoint', () => {
    expect(res.suggestedSpringNmm).toBe(9.5)
  })

  it('echoes the front target bands', () => {
    expect(res.targetRiderSagMm).toEqual([30, 40])
    expect(res.targetFreeSagMm).toEqual([15, 30])
  })
})

describe('analyzeSag — rear, free sag below band (classic soft-spring tell)', () => {
  // L1 600, L2 599, L3 572, travel 130
  // free  = 600 − 599 = 1   → below [5, 10] ⇒ 'too-soft'
  //   (lots of preload masks a soft spring; the bike tops out)
  // rider = 600 − 572 = 28  → in [25, 35] ⇒ 'ok'
  const res = analyzeSag({ l1: 600, l2: 599, l3: 572 }, 130, 'rear', 90)

  it('computes sags', () => {
    expect(res.freeSagMm).toBe(1)
    expect(res.riderSagMm).toBe(28)
    // 28 / 130 × 100 = 21.538461…
    expect(res.riderSagPctOfTravel).toBeCloseTo(21.5384615385, 6)
  })

  it('flags the spring as too soft, direction matters', () => {
    expect(res.springVerdict).toBe('too-soft')
    expect(res.riderSagVerdict).toBe('ok')
  })

  it('suggests a softer spring for rider sag below mid', () => {
    // 90 × 28/30 = 84 exactly
    expect(res.suggestedSpringNmm).toBe(84)
  })
})

describe('analyzeSag — rear, free sag above band, rider sag at upper boundary', () => {
  // L1 600, L2 588, L3 565, travel 130
  // free  = 600 − 588 = 12 → above [5, 10] ⇒ 'too-stiff'
  // rider = 600 − 565 = 35 → 35 is the UPPER BOUNDARY of [25, 35]
  //   boundaries are INCLUSIVE ⇒ 'ok', NOT 'high'
  const res = analyzeSag({ l1: 600, l2: 588, l3: 565 }, 130, 'rear', 95)

  it('flags the spring as too stiff', () => {
    expect(res.freeSagMm).toBe(12)
    expect(res.springVerdict).toBe('too-stiff')
  })

  it('treats the band boundary as inclusive — 35 mm on [25, 35] is ok', () => {
    expect(res.riderSagMm).toBe(35)
    expect(res.riderSagVerdict).toBe('ok')
  })
})

describe('analyzeSag — rear, rider sag above band', () => {
  // L1 600, L2 593, L3 560, travel 130, spring 95 N/mm
  // free  = 600 − 593 = 7  → in [5, 10] ⇒ spring 'ok'
  // rider = 600 − 560 = 40 → above [25, 35] ⇒ 'high'
  // suggestion = 95 × 40/30 = 126.666… → nearest 0.05 ⇒ 126.65
  const res = analyzeSag({ l1: 600, l2: 593, l3: 560 }, 130, 'rear', 95)

  it('flags rider sag as high', () => {
    expect(res.riderSagMm).toBe(40)
    expect(res.riderSagVerdict).toBe('high')
    expect(res.springVerdict).toBe('ok')
  })

  it('suggests a stiffer spring, rounded to 0.05 N/mm', () => {
    expect(res.suggestedSpringNmm).toBe(126.65)
  })
})

describe('analyzeSag — rider sag below band', () => {
  // Front: L1 770, L2 750, L3 745, travel 120
  // free  = 20 → in [15, 30] ⇒ 'ok'
  // rider = 25 → below [30, 40] ⇒ 'low'
  // suggestion = 9.5 × 25/35 = 6.7857… → nearest 0.05 ⇒ 6.8
  const res = analyzeSag({ l1: 770, l2: 750, l3: 745 }, 120, 'front', 9.5)

  it('flags rider sag as low and suggests a softer spring', () => {
    expect(res.riderSagVerdict).toBe('low')
    expect(res.springVerdict).toBe('ok')
    expect(res.suggestedSpringNmm).toBe(6.8)
  })
})

describe('analyzeSag — missing measurement', () => {
  const res = analyzeSag(undefined, 120, 'front', 9.5)

  it('returns nulls and n/a everywhere', () => {
    expect(res.freeSagMm).toBeNull()
    expect(res.riderSagMm).toBeNull()
    expect(res.riderSagPctOfTravel).toBeNull()
    expect(res.riderSagVerdict).toBe('n/a')
    expect(res.springVerdict).toBe('n/a')
    expect(res.suggestedSpringNmm).toBeNull()
  })

  it('still reports the target bands for the UI', () => {
    expect(res.targetRiderSagMm).toEqual([30, 40])
    expect(res.targetFreeSagMm).toEqual([15, 30])
  })
})

describe('analyzeSag — negative sag (measurement error)', () => {
  // L2 > L1: free sag negative — physically impossible, so verdicts are 'n/a'
  // and no suggestion is made, but the RAW numbers are still returned
  // (not clamped, not nulled) so the user can see what their inputs produce.
  const res = analyzeSag({ l1: 600, l2: 605, l3: 570 }, 130, 'rear', 95)

  it('returns the raw negative numbers', () => {
    expect(res.freeSagMm).toBe(-5)
    expect(res.riderSagMm).toBe(30)
    // 30 / 130 × 100 = 23.0769…
    expect(res.riderSagPctOfTravel).toBeCloseTo(23.0769230769, 6)
  })

  it('withholds verdicts and suggestion', () => {
    expect(res.riderSagVerdict).toBe('n/a')
    expect(res.springVerdict).toBe('n/a')
    expect(res.suggestedSpringNmm).toBeNull()
  })

  it('also treats negative rider sag (l3 > l1) as an error', () => {
    const r2 = analyzeSag({ l1: 600, l2: 595, l3: 610 }, 130, 'rear', 95)
    expect(r2.riderSagMm).toBe(-10)
    expect(r2.freeSagMm).toBe(5)
    expect(r2.riderSagVerdict).toBe('n/a')
    expect(r2.springVerdict).toBe('n/a')
    expect(r2.suggestedSpringNmm).toBeNull()
  })
})
