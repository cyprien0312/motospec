// Data Table (Advance): genuine-only sister page to data-table.js.
// v1 is static at-rest (load case forced to zero). Every cell is either a
// real computed value or blank — no mocks, no fallbacks, no placeholder coords.

import { ROW_GROUPS as LEGACY_ROW_GROUPS } from './data-table.js';
import { P, computeAll } from './formulas.js';
import {
  matchesPlaceholder,
  LINKAGE_COORD_FIELDS,
  LINKAGE_PLACEHOLDER_LINKED,
  LINKAGE_PLACEHOLDER_PROLINK,
} from './linkage-setup.js';
import { materializeBikeInputs } from './catalog.js';

/**
 * Returns true if the bike's linkage coordinates match either the
 * pro-link or linked placeholder set. Such a bike does NOT have real
 * linkage coords and must produce missing values for every linkage-
 * dependent result on the advance page.
 */
export function isPlaceholderCoords(inputs) {
  const mode = inputs.Linkage_Mode || 'pro-link';
  return matchesPlaceholder(inputs, mode);
}

/**
 * Walk P[name].deps transitively. A name is a "leaf" if it does not appear
 * as a key in P (i.e., it's a declared input from INPUT_META, not a computed
 * channel/intermediate).
 *
 * Returns a sorted array of leaf input names. Self is excluded.
 */
export function leafDepsFor(name) {
  const seen = new Set();
  const leaves = new Set();

  function visit(n) {
    if (seen.has(n)) return;
    seen.add(n);
    const node = P[n];
    if (!node) {
      // Not in P → it's a leaf input.
      leaves.add(n);
      return;
    }
    const deps = node.deps || [];
    if (deps.length === 0) {
      // No deps → treat as a leaf input (declared in P with type 'input').
      leaves.add(n);
      return;
    }
    for (const d of deps) visit(d);
  }

  const root = P[name];
  if (!root) {
    // Caller passed a leaf — return it as its own dep.
    return [name];
  }
  for (const d of (root.deps || [])) visit(d);
  return [...leaves].sort();
}

const LEGACY_RESULTS = LEGACY_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;

// 15 result rows (CofG % Front and Rear are separate derivedFrom rows),
// identical order to legacy. Status badges are intentionally dropped —
// presence of a number IS the proof of realness on this page.
const ADVANCE_RESULT_ROWS = LEGACY_RESULTS.map(r => {
  const next = { spec: r.spec, spec_zh: r.spec_zh };
  if (r.computed) next.computed = r.computed;
  if (r.derivedFrom) next.derivedFrom = r.derivedFrom;
  return next;
});

export const ADVANCE_RESULT_ORDER = ADVANCE_RESULT_ROWS.map(
  r => r.computed || r.spec
);

// Input rows are computed lazily in Task 3 from the dependency graph.
// For now the schema only contains the RESULTS group.
export const ADVANCE_ROW_GROUPS = [
  { header: 'RESULTS', header_zh: '结果', rows: ADVANCE_RESULT_ROWS },
];

const LINKAGE_DEP_NAMES = new Set(LINKAGE_COORD_FIELDS);

// Result channels whose CALC reads the linkage solver state directly but
// whose declared `deps: []` doesn't expose those leaves. These must still be
// flagged missing when the bike has placeholder linkage coords.
const LINKAGE_DEPENDENT_RESULTS = new Set([
  'Motion_Ratio',
  'Progression',
  'Rear_Ride_Height',
  'Rear_Wheel_Vertical_Travel',
  'Rear_Wheel_Rate',
  'Rear_Wheel_Force',
]);

// Result keys derived from ADVANCE_RESULT_ROWS — only those with a `computed`
// channel run through the validation+computeAll pipeline. Rows with
// `derivedFrom` (e.g. CofG % Front/Rear) are handled by the renderer in Task 6.
const COMPUTED_RESULT_KEYS = ADVANCE_ROW_GROUPS
  .find(g => g.header === 'RESULTS')
  .rows
  .filter(r => r.computed)
  .map(r => r.computed);

/**
 * Force load case to zero. v1 is static at-rest only.
 */
function forceStaticAtRest(inputs) {
  return {
    ...inputs,
    Travel_Front: 0,
    Travel_Rear: 0,
    Lean_Angle: 0,
    a_x: 0,
    V: 0,
  };
}

/**
 * Returns { missing, missingLeaves } for one result given inputs and
 * its required leaf set. If the result is linkage-dependent and the
 * coords are the placeholder set, the linkage coord fields are reported
 * as missing.
 */
function validateInputs(inputs, requiredLeaves, isPlaceholder, key) {
  const dependsOnLinkage =
    requiredLeaves.some(l => LINKAGE_DEP_NAMES.has(l)) ||
    LINKAGE_DEPENDENT_RESULTS.has(key);
  if (dependsOnLinkage && isPlaceholder) {
    const linkageMissing = requiredLeaves.filter(l => LINKAGE_DEP_NAMES.has(l));
    return {
      missing: true,
      missingLeaves: linkageMissing.length ? linkageMissing : ['(linkage coords)'],
    };
  }
  const missingLeaves = [];
  for (const leaf of requiredLeaves) {
    const v = inputs[leaf];
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) {
      missingLeaves.push(leaf);
    }
  }
  return missingLeaves.length
    ? { missing: true, missingLeaves }
    : { missing: false, missingLeaves: [] };
}

/**
 * For one bike, return per-result { value, missing, missingLeaves } for each
 * computed result key. Only rows with a `computed` channel are included;
 * `derivedFrom` rows (CofG %) are handled by the renderer.
 */
export function computeAdvanceResults(bike) {
  // bike.values (legacy data-table shape) carries the full flat input dict —
  // including bike geometry, environment, setup, preset overlays, and any
  // user edits in the data-table UI. materializeBikeInputs covers the
  // catalog-only shape (geometry/environment/setup branches). Merge both so
  // either bike shape works.
  const materialized = materializeBikeInputs(bike);
  const baseInputs = { ...materialized, ...(bike.values || {}) };

  // If no linkage component is selected, the linkage coord values cached on
  // bike.values are stale — overwrite them with the placeholder set so that
  // isPlaceholderCoords detects the missing real coords.
  if (!bike.components || bike.components.linkage == null) {
    const mode = baseInputs.Linkage_Mode || 'pro-link';
    const placeholder = mode === 'pro-link'
      ? LINKAGE_PLACEHOLDER_PROLINK
      : LINKAGE_PLACEHOLDER_LINKED;
    Object.assign(baseInputs, placeholder);
  }

  const inputs = forceStaticAtRest(baseInputs);
  const isPlaceholder = isPlaceholderCoords(inputs);

  const validation = {};
  for (const key of COMPUTED_RESULT_KEYS) {
    const leaves = leafDepsFor(key);
    validation[key] = validateInputs(inputs, leaves, isPlaceholder, key);
  }

  const computed = computeAll(inputs);

  const out = {};
  for (const key of COMPUTED_RESULT_KEYS) {
    const v = validation[key];
    if (v.missing) {
      out[key] = { value: null, missing: true, missingLeaves: v.missingLeaves };
      continue;
    }
    const value = computed[key];
    if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) {
      out[key] = { value: null, missing: true, missingLeaves: ['(computation produced non-finite)'] };
    } else {
      out[key] = { value, missing: false, missingLeaves: [] };
    }
  }
  return out;
}
