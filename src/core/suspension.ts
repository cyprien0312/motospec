/**
 * Suspension sag analysis (static).
 *
 * Definitions (all mm, measured along the suspension end being analysed):
 *   L1 = wheel fully extended (bike on a stand)
 *   L2 = bike settled under its own weight
 *   L3 = bike settled with the rider aboard, in riding position
 *
 *   freeSag  = L1 − L2   (how far the bike settles on its own)
 *   riderSag = L1 − L3   (how far it settles with the rider)
 *
 * Verdict logic:
 *   - riderSagVerdict compares riderSag against the target band:
 *     'low' below, 'high' above, 'ok' inside (band boundaries INCLUSIVE).
 *   - springVerdict is the classic free-sag rule. It assumes rider sag has
 *     been dialled in with preload. If free sag is BELOW its band, a soft
 *     spring needed lots of preload to reach rider sag, so the bike tops out
 *     with almost no static settle ⇒ 'too-soft'. If free sag is ABOVE the
 *     band, a stiff spring needed very little preload ⇒ 'too-stiff'.
 *
 * Spring suggestion — proportional linear model (documented assumption):
 *   Suspension is treated as a linear spring with fixed preload, so sag is
 *   inversely proportional to spring rate. To move the measured rider sag to
 *   the MIDPOINT of its target band:
 *     suggested = current × riderSag / midpoint(target rider band)
 *   The result is rounded to the nearest 0.05 N/mm. This ignores linkage
 *   ratio changes, preload adjustments and stiction — it is a starting-point
 *   estimate, not a guarantee.
 *
 * Defensive handling of bad measurements:
 *   If L2 or L3 exceeds L1 the sag comes out NEGATIVE, which is physically
 *   impossible and indicates a measurement/transcription error. We do NOT
 *   clamp or null the numbers — the raw (negative) values are returned so the
 *   UI can show the user exactly what their inputs produce — but both
 *   verdicts become 'n/a' and no spring suggestion is made, since advice
 *   derived from impossible data would be meaningless.
 */

import type { SagAnalysis, SagMeasurement, SagVerdict } from './types'

/**
 * Target sag bands in mm (road/track compromise), inclusive boundaries.
 * Exported so the UI can render the bands alongside measurements.
 */
export const SAG_TARGETS: {
  readonly front: { readonly rider: [number, number]; readonly free: [number, number] }
  readonly rear: { readonly rider: [number, number]; readonly free: [number, number] }
} = {
  front: { rider: [30, 40], free: [15, 30] },
  rear: { rider: [25, 35], free: [5, 10] },
}

/** Round to the nearest 0.05 N/mm. */
function roundToNickel(x: number): number {
  return Math.round(x * 20) / 20
}

/** Compare a value against an inclusive [lo, hi] band. */
function bandPosition(value: number, band: [number, number]): 'below' | 'in' | 'above' {
  const [lo, hi] = band
  if (value < lo) return 'below'
  if (value > hi) return 'above'
  return 'in'
}

export function analyzeSag(
  meas: SagMeasurement | undefined,
  travelMm: number,
  end: 'front' | 'rear',
  currentSpringNmm: number,
): SagAnalysis {
  const targets = SAG_TARGETS[end]
  const targetRiderSagMm: [number, number] = [targets.rider[0], targets.rider[1]]
  const targetFreeSagMm: [number, number] = [targets.free[0], targets.free[1]]

  if (!meas) {
    return {
      freeSagMm: null,
      riderSagMm: null,
      riderSagPctOfTravel: null,
      targetRiderSagMm,
      targetFreeSagMm,
      riderSagVerdict: 'n/a',
      springVerdict: 'n/a',
      suggestedSpringNmm: null,
    }
  }

  const freeSagMm = meas.l1 - meas.l2
  const riderSagMm = meas.l1 - meas.l3
  const riderSagPctOfTravel = travelMm > 0 ? (riderSagMm / travelMm) * 100 : null

  // Negative sag = measurement error: report the raw numbers, withhold advice.
  if (freeSagMm < 0 || riderSagMm < 0) {
    return {
      freeSagMm,
      riderSagMm,
      riderSagPctOfTravel,
      targetRiderSagMm,
      targetFreeSagMm,
      riderSagVerdict: 'n/a',
      springVerdict: 'n/a',
      suggestedSpringNmm: null,
    }
  }

  const riderPos = bandPosition(riderSagMm, targetRiderSagMm)
  const riderSagVerdict: SagVerdict =
    riderPos === 'below' ? 'low' : riderPos === 'above' ? 'high' : 'ok'

  // Free-sag rule: below band ⇒ too soft (preload masking a soft spring),
  // above band ⇒ too stiff.
  const freePos = bandPosition(freeSagMm, targetFreeSagMm)
  const springVerdict: SagVerdict =
    freePos === 'below' ? 'too-soft' : freePos === 'above' ? 'too-stiff' : 'ok'

  // Proportional linear model (see module doc).
  const targetMid = (targetRiderSagMm[0] + targetRiderSagMm[1]) / 2
  const suggestedSpringNmm = roundToNickel((currentSpringNmm * riderSagMm) / targetMid)

  return {
    freeSagMm,
    riderSagMm,
    riderSagPctOfTravel,
    targetRiderSagMm,
    targetFreeSagMm,
    riderSagVerdict,
    springVerdict,
    suggestedSpringNmm,
  }
}
