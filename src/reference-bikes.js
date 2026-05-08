// ============================================================
// MotoSPEC reference-bike encodings
// ============================================================
//
// The three columns are intentionally blank placeholders ("Bike A/B/C").
// The previous Yamaha R7 / Suzuki GSX-8R / Aprilia RS 660 rows were
// removed because their geometry / linkage numbers were never accurate
// enough to validate against the CSV — see git history for the mockup
// values.
//
// To populate a column: pick a chassis profile from the chassis catalog
// + components from the part catalogs (forks, shocks, linkages),
// or type values directly into the cells. Real spec
// sheets are tracked in docs/research/chassis-coords.md and
// docs/research/linkage-coords.md.

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


// Three neutral placeholder columns. Empty `components` + `geometry`
// means the bike inherits everything from `defaultValues()` until the
// user picks a chassis / part-catalog entry or types a value into the
// table cell.
const BIKES = [
  { id: 'bike-a', name: 'Bike A', components: {}, geometry: {}, environment: COMMON_ENV, setup: {}, expected: {} },
  { id: 'bike-b', name: 'Bike B', components: {}, geometry: {}, environment: COMMON_ENV, setup: {}, expected: {} },
  { id: 'bike-c', name: 'Bike C', components: {}, geometry: {}, environment: COMMON_ENV, setup: {}, expected: {} },
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
  dynamic_presets: DYNAMIC_PRESETS,
}));
