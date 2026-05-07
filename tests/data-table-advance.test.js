import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCE_ROW_GROUPS, ADVANCE_RESULT_ORDER } from '../src/data-table-advance.js';
import { ROW_GROUPS as LEGACY_ROW_GROUPS } from '../src/data-table.js';

test('advance result rows match legacy RESULTS order exactly', () => {
  const legacyResults = LEGACY_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const legacyOrder = legacyResults.map(r => r.computed || r.spec);

  const advResults = ADVANCE_ROW_GROUPS.find(g => g.header === 'RESULTS').rows;
  const advOrder = advResults.map(r => r.computed || r.spec);

  assert.deepEqual(advOrder, legacyOrder);
});

test('ADVANCE_RESULT_ORDER lists all 15 legacy RESULTS rows (CofG % Front + Rear are separate derivedFrom rows)', () => {
  assert.equal(ADVANCE_RESULT_ORDER.length, 15);
});
