// Data Table (Advance): genuine-only sister page to data-table.js.
// v1 is static at-rest (load case forced to zero). Every cell is either a
// real computed value or blank — no mocks, no fallbacks, no placeholder coords.

import { ROW_GROUPS as LEGACY_ROW_GROUPS } from './data-table.js';

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
