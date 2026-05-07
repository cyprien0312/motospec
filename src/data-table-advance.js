// Data Table (Advance): genuine-only sister page to data-table.js.
// v1 is static at-rest (load case forced to zero). Every cell is either a
// real computed value or blank — no mocks, no fallbacks, no placeholder coords.

import { ROW_GROUPS as LEGACY_ROW_GROUPS } from './data-table.js';
import { P } from './formulas.js';

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
