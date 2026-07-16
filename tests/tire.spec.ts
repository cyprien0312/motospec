import { describe, expect, it } from 'vitest'
import { parseTire, tireDims } from '../src/core/tire'

describe('parseTire', () => {
  it('parses the plain radial form "120/70ZR17"', () => {
    expect(parseTire('120/70ZR17')).toEqual({ widthMm: 120, aspectPct: 70, rimInch: 17 })
  })

  it('parses the dash form "120/70-17"', () => {
    expect(parseTire('120/70-17')).toEqual({ widthMm: 120, aspectPct: 70, rimInch: 17 })
  })

  it('parses spaced form "120/70 R 17"', () => {
    expect(parseTire('120/70 R 17')).toEqual({ widthMm: 120, aspectPct: 70, rimInch: 17 })
  })

  it('parses spaced ZR form "180/55 ZR 17"', () => {
    expect(parseTire('180/55 ZR 17')).toEqual({ widthMm: 180, aspectPct: 55, rimInch: 17 })
  })

  it('parses "200/60R17"', () => {
    expect(parseTire('200/60R17')).toEqual({ widthMm: 200, aspectPct: 60, rimInch: 17 })
  })

  it('parses motorcycle-marked form "120/70R17M/C"', () => {
    expect(parseTire('120/70R17M/C')).toEqual({ widthMm: 120, aspectPct: 70, rimInch: 17 })
  })

  it('is case and whitespace tolerant', () => {
    expect(parseTire('  120 / 70 zr 17  ')).toEqual({ widthMm: 120, aspectPct: 70, rimInch: 17 })
    expect(parseTire('180/55zr17')).toEqual({ widthMm: 180, aspectPct: 55, rimInch: 17 })
  })

  it('accepts fractional rims like the 16.5" race size', () => {
    expect(parseTire('125/75R16.5')).toEqual({ widthMm: 125, aspectPct: 75, rimInch: 16.5 })
  })

  it('rejects the empty string', () => {
    expect(() => parseTire('')).toThrow(/empty/i)
    expect(() => parseTire('   ')).toThrow(/empty/i)
  })

  it('rejects nonsense like "banana"', () => {
    expect(() => parseTire('banana')).toThrow(/cannot parse/i)
  })

  it('rejects a spec with no rim size: "120/70"', () => {
    expect(() => parseTire('120/70')).toThrow(/cannot parse/i)
  })

  it('rejects all-dash form "120-70-17" (width/aspect must use a slash)', () => {
    expect(() => parseTire('120-70-17')).toThrow(/cannot parse/i)
  })

  it('rejects an aspect/rim run-on with no separator: "120/7017"', () => {
    expect(() => parseTire('120/7017')).toThrow(/cannot parse/i)
  })

  it('rejects physically implausible sizes with a range message', () => {
    expect(() => parseTire('120/70-99')).toThrow(/rim/i)
    expect(() => parseTire('999/70-17')).toThrow(/cannot parse|width/i)
  })

  it('error message names the offending input', () => {
    expect(() => parseTire('not-a-tire')).toThrow(/not-a-tire/)
  })
})

describe('tireDims', () => {
  // Hand computation, 120/70-17:
  //   radius = 17 * 25.4 / 2 + 120 * 70/100 = 215.9 + 84 = 299.9 mm
  //   diameter = 599.8 mm
  //   circumference = 599.8 * pi = 1884.327 mm
  it('120/70-17: radius 299.9 mm, circumference ~1884.3 mm', () => {
    const d = tireDims('120/70-17')
    expect(d.radiusMm).toBeCloseTo(299.9, 6)
    expect(d.diameterMm).toBeCloseTo(599.8, 6)
    expect(d.circumferenceMm).toBeCloseTo(1884.327, 2)
  })

  // 180/55-17: 215.9 + 180*0.55 = 215.9 + 99 = 314.9 mm
  it('180/55-17: radius 314.9 mm', () => {
    const d = tireDims('180/55-17')
    expect(d.radiusMm).toBeCloseTo(314.9, 6)
    expect(d.diameterMm).toBeCloseTo(629.8, 6)
    expect(d.circumferenceMm).toBeCloseTo(629.8 * Math.PI, 6)
  })

  // 190/50-17: 215.9 + 190*0.50 = 215.9 + 95 = 310.9 mm
  it('190/50-17: radius 310.9 mm', () => {
    const d = tireDims('190/50-17')
    expect(d.radiusMm).toBeCloseTo(310.9, 6)
  })

  // 200/60R17: 215.9 + 200*0.60 = 215.9 + 120 = 335.9 mm
  it('200/60R17: radius 335.9 mm', () => {
    const d = tireDims('200/60R17')
    expect(d.radiusMm).toBeCloseTo(335.9, 6)
  })

  it('diameter and circumference are consistent with the radius', () => {
    const d = tireDims('120/70ZR17')
    expect(d.diameterMm).toBeCloseTo(2 * d.radiusMm, 9)
    expect(d.circumferenceMm).toBeCloseTo(Math.PI * d.diameterMm, 9)
  })

  it('throws on unparseable input, same as parseTire', () => {
    expect(() => tireDims('banana')).toThrow(/cannot parse/i)
  })
})
