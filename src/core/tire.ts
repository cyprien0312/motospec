/**
 * Tire size parsing & dimensions.
 *
 * Accepts the common metric motorcycle designations, case/whitespace
 * tolerant:
 *   "120/70ZR17", "120/70-17", "120/70 R 17", "180/55 ZR 17",
 *   "200/60R17", "120/70R17M/C"
 *
 * widthMm / aspectPct / rimInch per the TireSpec contract in types.ts.
 */
import type { TireDims, TireSpec } from './types'

/**
 * width "/" aspect <separator> rim ["M/C"]
 *  - width: 2-3 digits (mm)
 *  - aspect: 2-3 digits (percent)
 *  - separator: "ZR" | "R" | "B" | "-" | whitespace (required, so that
 *    "120/7017" and "120/70" are rejected)
 *  - rim: 1-2 digits, optional decimal (inches, e.g. 16.5 race fronts)
 *  - optional motorcycle marking "M/C" (or "MC")
 */
const TIRE_RE = /^(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:ZR|R|B|-|\s)\s*(\d{1,2}(?:\.\d+)?)\s*(?:M\/?C)?$/

const FORMAT_HINT = 'expected width/aspect + rim, e.g. "120/70ZR17", "180/55-17" or "120/70 R 17"'

/**
 * Parse a metric tire designation into its numeric parts.
 * Throws an Error with a helpful message on unparseable input.
 */
export function parseTire(spec: string): TireSpec {
  const normalized = spec.trim().toUpperCase()
  if (normalized === '') {
    throw new Error(`Tire spec is empty — ${FORMAT_HINT}`)
  }

  const m = TIRE_RE.exec(normalized)
  const widthStr = m?.[1]
  const aspectStr = m?.[2]
  const rimStr = m?.[3]
  if (widthStr === undefined || aspectStr === undefined || rimStr === undefined) {
    throw new Error(`Cannot parse tire spec "${spec}" — ${FORMAT_HINT}`)
  }

  const widthMm = Number(widthStr)
  const aspectPct = Number(aspectStr)
  const rimInch = Number(rimStr)

  if (widthMm < 60 || widthMm > 360) {
    throw new Error(`Tire spec "${spec}": width ${widthMm} mm is out of range (60–360 mm)`)
  }
  if (aspectPct < 25 || aspectPct > 100) {
    throw new Error(`Tire spec "${spec}": aspect ratio ${aspectPct}% is out of range (25–100%)`)
  }
  if (rimInch < 8 || rimInch > 25) {
    throw new Error(`Tire spec "${spec}": rim ${rimInch}" is out of range (8–25 in)`)
  }

  return { widthMm, aspectPct, rimInch }
}

/**
 * Unloaded tire dimensions, mm.
 * radiusMm = rimInch*25.4/2 + widthMm*aspectPct/100
 */
export function tireDims(spec: string): TireDims {
  const { widthMm, aspectPct, rimInch } = parseTire(spec)
  const radiusMm = (rimInch * 25.4) / 2 + (widthMm * aspectPct) / 100
  return {
    radiusMm,
    diameterMm: 2 * radiusMm,
    circumferenceMm: 2 * Math.PI * radiusMm,
  }
}
