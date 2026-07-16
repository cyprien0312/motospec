/**
 * Factory bike presets + stock setup factory.
 *
 * Sources: manufacturer spec sheets / press kits where available.
 * Marker convention (used consistently throughout this file):
 *   // approx     — published figure recalled from spec sheets, not re-verified
 *   // estimated  — not published anywhere; plausible engineering estimate
 *
 * forkOffsetMm is NOT the published triple-clamp offset: it is SOLVED from
 *   offset = R·sin(rake) − refTrail·cos(rake)
 * (R = unloaded front tire radius per tire.ts: rim·25.4/2 + width·aspect/100)
 * so that the geometry engine's trail formula trail = (R·sinθ − o)/cosθ
 * reproduces refTrailMm exactly at reference. All six presets use a 120/70-17
 * front (R = 299.9 mm); each offset below was checked to ±0.01 mm.
 *
 * swingarmLengthMm is likewise back-solved (within plausible bounds) so the
 * chain-length formula at stock sprockets reproduces stockChainLinks exactly —
 * a stock setup must derive warning-free.
 */
import type { BikeProfile, Setup } from './types'

export const PRESET_BIKES: BikeProfile[] = [
  {
    // Yamaha press spec, 2017 YZF-R6 (RJ27)
    id: 'preset-r6',
    name: 'Yamaha YZF-R6 (2017)',
    category: 'supersport',
    rakeDeg: 24,
    forkOffsetMm: 33.37, // solved: 299.9·sin24° − 97·cos24°
    refTrailMm: 97,
    wheelbaseMm: 1375,
    swingarmLengthMm: 591, // estimated, back-solved from 114-link stock chain
    swingarmPivotHeightMm: 480, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 190,
    weightFrontPct: 52.5, // estimated
    cgHeightMm: 600, // estimated
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontWheelTravelMm: 120,
    rearWheelTravelMm: 120,
    stockFrontSpringNmm: 9.3, // estimated (per leg)
    stockRearSpringNmm: 95, // estimated
    gearbox: {
      primary: 2.073, // 85/41
      gears: [2.583, 2.0, 1.667, 1.444, 1.286, 1.15],
    },
    chainPitch: '525',
    stockFrontSprocket: 16,
    stockRearSprocket: 45,
    stockChainLinks: 114,
    preset: true,
  },
  {
    // Kawasaki press spec, 2019 Ninja ZX-6R 636
    id: 'preset-zx6r',
    name: 'Kawasaki ZX-6R 636 (2019)',
    category: 'supersport',
    rakeDeg: 23.5,
    forkOffsetMm: 26.96, // solved: 299.9·sin23.5° − 101·cos23.5°
    refTrailMm: 101,
    wheelbaseMm: 1400,
    swingarmLengthMm: 604, // estimated, back-solved from 114-link stock chain
    swingarmPivotHeightMm: 480, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 196, // approx (196.5 kg curb, KRT ABS)
    weightFrontPct: 52, // estimated
    cgHeightMm: 595, // estimated
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontWheelTravelMm: 120,
    rearWheelTravelMm: 134, // approx
    stockFrontSpringNmm: 9.5, // estimated (per leg)
    stockRearSpringNmm: 95, // estimated
    gearbox: {
      primary: 1.9, // 76/40
      gears: [2.846, 2.2, 1.85, 1.6, 1.421, 1.3], // 5th/6th approx
    },
    chainPitch: '520',
    stockFrontSprocket: 15,
    stockRearSprocket: 43,
    stockChainLinks: 114, // approx
    preset: true,
  },
  {
    // BMW press spec, 2020 S 1000 RR (K67)
    id: 'preset-s1000rr',
    name: 'BMW S1000RR (2020)',
    category: 'superbike',
    rakeDeg: 23.1,
    forkOffsetMm: 31.29, // solved: 299.9·sin23.1° − 93.9·cos23.1°
    refTrailMm: 93.9,
    wheelbaseMm: 1441,
    swingarmLengthMm: 620, // estimated, back-solved from 118-link stock chain
    swingarmPivotHeightMm: 490, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 197, // approx (DIN unladen, road trim)
    weightFrontPct: 52.5, // estimated
    cgHeightMm: 610, // estimated
    frontTire: '120/70ZR17',
    rearTire: '200/55ZR17',
    frontWheelTravelMm: 120,
    rearWheelTravelMm: 117,
    stockFrontSpringNmm: 10, // estimated (per leg)
    stockRearSpringNmm: 100, // estimated
    gearbox: {
      primary: 1.652,
      gears: [2.647, 2.091, 1.727, 1.476, 1.304, 1.174], // 6th approx
    },
    chainPitch: '525',
    stockFrontSprocket: 17,
    stockRearSprocket: 45,
    stockChainLinks: 118, // approx
    preset: true,
  },
  {
    // Ducati press spec, 2020 Panigale V2 (955 Superquadro)
    id: 'preset-panigale-v2',
    name: 'Ducati Panigale V2 (2020)',
    category: 'superbike',
    rakeDeg: 24,
    forkOffsetMm: 36.11, // solved: 299.9·sin24° − 94·cos24°
    refTrailMm: 94,
    wheelbaseMm: 1436,
    swingarmLengthMm: 540, // estimated, back-solved from 106-link stock chain
    swingarmPivotHeightMm: 485, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 200, // approx (kerb)
    weightFrontPct: 52, // estimated
    cgHeightMm: 605, // estimated
    frontTire: '120/70ZR17',
    rearTire: '180/60ZR17',
    frontWheelTravelMm: 120,
    rearWheelTravelMm: 130,
    stockFrontSpringNmm: 9.8, // estimated (per leg)
    stockRearSpringNmm: 95, // estimated
    gearbox: {
      primary: 1.77, // approx (straight-cut primary)
      gears: [2.467, 1.875, 1.588, 1.389, 1.263, 1.15], // approx (1st = 37/15)
    },
    chainPitch: '520',
    stockFrontSprocket: 15,
    stockRearSprocket: 43,
    stockChainLinks: 106, // per OEM chain-kit listings
    preset: true,
  },
  {
    // Yamaha press spec, 2021 MT-09 (889 CP3)
    id: 'preset-mt09',
    name: 'Yamaha MT-09 (2021)',
    category: 'naked',
    rakeDeg: 25,
    forkOffsetMm: 28.86, // solved: 299.9·sin25° − 108·cos25°
    refTrailMm: 108,
    wheelbaseMm: 1430,
    swingarmLengthMm: 560, // estimated, back-solved from 110-link stock chain
    swingarmPivotHeightMm: 470, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 189,
    weightFrontPct: 50.5, // estimated
    cgHeightMm: 590, // estimated
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontWheelTravelMm: 130,
    rearWheelTravelMm: 122,
    stockFrontSpringNmm: 8.8, // estimated (per leg)
    stockRearSpringNmm: 90, // estimated
    gearbox: {
      primary: 1.681, // approx (79/47)
      gears: [2.571, 1.947, 1.619, 1.381, 1.19, 1.037], // 3rd–6th approx
    },
    chainPitch: '525',
    stockFrontSprocket: 16,
    stockRearSprocket: 45,
    stockChainLinks: 110, // approx
    preset: true,
  },
  {
    // Honda press spec, CB650R (2019–)
    id: 'preset-cb650r',
    name: 'Honda CB650R',
    category: 'naked',
    rakeDeg: 25.5,
    forkOffsetMm: 37.95, // solved: 299.9·sin25.5° − 101·cos25.5°
    refTrailMm: 101,
    wheelbaseMm: 1450,
    swingarmLengthMm: 640, // estimated, back-solved from 118-link stock chain
    swingarmPivotHeightMm: 465, // estimated
    countershaftVsPivot: { dxMm: 60, dzMm: 20 }, // estimated
    massKg: 202, // approx (202.5 kg kerb)
    weightFrontPct: 50, // estimated
    cgHeightMm: 580, // estimated
    frontTire: '120/70ZR17',
    rearTire: '180/55ZR17',
    frontWheelTravelMm: 120, // approx
    rearWheelTravelMm: 130, // estimated
    stockFrontSpringNmm: 8.8, // estimated (per leg)
    stockRearSpringNmm: 98, // estimated
    gearbox: {
      primary: 1.69, // 71/42
      gears: [3.071, 2.353, 1.889, 1.56, 1.37, 1.214],
    },
    chainPitch: '525',
    stockFrontSprocket: 15,
    stockRearSprocket: 42,
    stockChainLinks: 118, // approx
    preset: true,
  },
]

/**
 * Stock setup for a bike: every adjustment zeroed, factory rolling stock and
 * gearing, 75 kg rider, no sag measurements taken yet. The store fills in
 * id/createdAt; core never generates ids.
 */
export function defaultSetup(bike: BikeProfile): Setup {
  return {
    id: '',
    bikeId: bike.id,
    name: 'Stock',
    notes: '',
    createdAt: '',
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
    chainLinks: bike.stockChainLinks,
    riderKg: 75,
  }
}
