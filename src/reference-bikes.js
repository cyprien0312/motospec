// ============================================================
// MotoSPEC reference-bike encodings
// Source of truth: /motospec-style-table.csv
// ============================================================
//
// Phase 1 schema: bikes reference components by part-code (see
// `data/*.json` and `src/catalog.js`). The flat `inputs` field exported
// alongside each bike is materialized at module-load time so the rest of
// the pipeline (computeAll, data-table, tests) keeps working unchanged.
//
// CSV column → preset mapping:
//   R7     → "Sag", GSX-8R → "Braking", RS660 → "Mid-Corner"
// `expected.<preset>` is populated only for the preset the CSV gives.

import { materializeBikeInputs, componentName } from './catalog.js';

const DYNAMIC_PRESETS = {
  sag:        { Travel_Front: 30,  Travel_Rear: 10, Lean_Angle: 0  },
  braking:    { Travel_Front: 120, Travel_Rear: 2,  Lean_Angle: 0  },
  mid_corner: { Travel_Front: 80,  Travel_Rear: 20, Lean_Angle: 55 },
};

// Bike-intrinsic geometry shared across the three reference bikes
// where the spec sheets agree (only env block is truly shared today).
const COMMON_ENV = {
  a_x: 0.5,
  rho: 1.225,
  V: 30,
  Cd: 0.4,
  A: 0.5,
  C_f_aero: 0.4,
  C_r_aero: 0.6,
};

const BIKES = [
  {
    id: 'r7',
    name: 'Yamaha R7 2022',
    components: {
      clamp: 'yamaha-r7-stock',
      fork: 'fgk242',
      shock: 'ya-589',
      swingarm: 'yamaha-r7-2022',
      linkage: 'yamaha-r7-stock',
      front_tire: 'pir-sbk-120-70',
      rear_tire: 'pir-sbk-180-60',
      front_sprocket: 16,
      rear_sprocket: 42,
    },
    geometry: {
      Rake_Static: 24,
      Mass: 280,
      H_CG: 650,
      L_CG: 750,
      WB: 1400,
      front_weight_dist: 0.52,
      rear_weight_dist: 0.48,
      beta_static: 14,
      L_SA: 580,
    },
    environment: COMMON_ENV,
    setup: {
      Fork_Position: 5,
      Shock_Clevis_RHA: 0,
      Travel_Front: 30,
      Travel_Rear: 10,
    },
    expected: {
      sag: {
        Rake: 24.27, Ground_Trail: 97.8,
        Rear_Wheel_Vertical_Travel: 25.2, Rear_Ride_Height: -77.6,
        Swingarm_Angle: -8.37, AntiSquat_Pct: 109.2,
        Progression_Pct: 16.9, Motion_Ratio: 2.488,
        Wheelbase: 1403.5,
        Front_Wheel_Rate: 33.74, Rear_Wheel_Rate: 18.97,
        Front_Wheel_Force: 754.9, Rear_Wheel_Force: 1151.3,
        CofG_Front_Pct: 44.6, CofG_Rear_Pct: 55.4,
      },
      braking: null,
      mid_corner: null,
    },
  },
  {
    id: 'gsx8r',
    name: 'Suzuki GSX-8R 2024',
    components: {
      clamp: 'suzuki-gsx8r-stock',
      fork: 'showa-gsx8r',
      shock: 'showa-gsx8r',
      swingarm: 'suzuki-gsx8r-2024',
      linkage: 'suzuki-gsx8r-stock',
      front_tire: 'pir-sbk-120-70',
      rear_tire: 'pir-sbk-180-60',
      front_sprocket: 17,
      rear_sprocket: 47,
    },
    geometry: {
      Rake_Static: 25,
      Mass: 295,
      H_CG: 650,
      L_CG: 760,
      WB: 1430,
      front_weight_dist: 0.52,
      rear_weight_dist: 0.48,
      beta_static: 14,
      L_SA: 586.4,
    },
    environment: COMMON_ENV,
    setup: {
      Fork_Position: 0,
      Shock_Clevis_RHA: 0,
      Travel_Front: 120,
      Travel_Rear: 2,
    },
    expected: {
      sag: null,
      braking: {
        Rake: 21.09, Ground_Trail: 84.3,
        Rear_Wheel_Vertical_Travel: 5.3, Rear_Ride_Height: -63.4,
        Swingarm_Angle: -6.21, AntiSquat_Pct: 98.8,
        Progression_Pct: 34, Motion_Ratio: 2.672,
        Wheelbase: 1430.9,
        Front_Wheel_Rate: 28.96, Rear_Wheel_Rate: 45.91,
        Front_Wheel_Force: 2801.6, Rear_Wheel_Force: 469.2,
        CofG_Front_Pct: 53.6, CofG_Rear_Pct: 46.4,
      },
      mid_corner: null,
    },
  },
  {
    id: 'rs660',
    name: 'Aprilia RS 660 Factory 2025',
    components: {
      clamp: 'aprilia-rs660-stock',
      fork: 'fl-23030',
      shock: 'ap660',
      swingarm: 'aprilia-rs660-2025',
      linkage: 'aprilia-rs660-stock',
      front_tire: 'pir-sbk-120-70',
      rear_tire: 'pir-sbk-180-60',
      front_sprocket: 17,
      rear_sprocket: 43,
    },
    geometry: {
      Rake_Static: 24,
      Mass: 285,
      H_CG: 650,
      L_CG: 740,
      WB: 1370,
      front_weight_dist: 0.52,
      rear_weight_dist: 0.48,
      beta_static: 14,
      L_SA: 546.3,
    },
    environment: COMMON_ENV,
    setup: {
      Fork_Position: 10,
      Shock_Clevis_RHA: 0,
      Travel_Front: 80,
      Travel_Rear: 20,
    },
    expected: {
      sag: null,
      braking: null,
      mid_corner: {
        Rake: 21.13, Ground_Trail: 76.7,
        Rear_Wheel_Vertical_Travel: 52, Rear_Ride_Height: -46.3,
        Swingarm_Angle: -4.86, AntiSquat_Pct: 88.3,
        Progression_Pct: 5.2, Motion_Ratio: 2.584,
        Wheelbase: 1360.7,
        Front_Wheel_Rate: 31.85, Rear_Wheel_Rate: 24.61,
        Front_Wheel_Force: 2087.8, Rear_Wheel_Force: 1781.3,
        CofG_Front_Pct: 52.4, CofG_Rear_Pct: 47.6,
      },
    },
  },
];

// Materialize each bike: produce the legacy `inputs` flat dict + the
// human-readable component names that data-table.js reads off the bike.
export const REFERENCE_BIKES = BIKES.map(b => ({
  ...b,
  inputs: materializeBikeInputs(b),
  fork_name: componentName(b, 'fork'),
  shock_name: componentName(b, 'shock'),
  swingarm_name: componentName(b, 'swingarm'),
  link_name: componentName(b, 'linkage'),
  front_tire: componentName(b, 'front_tire'),
  rear_tire: componentName(b, 'rear_tire'),
  dynamic_presets: DYNAMIC_PRESETS,
}));
