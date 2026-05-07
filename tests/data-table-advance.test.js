import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCE_ROW_GROUPS, ADVANCE_RESULT_ORDER, leafDepsFor } from '../src/data-table-advance.js';
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

test('leafDepsFor returns leaves only (no intermediate channels)', () => {
  const leaves = leafDepsFor('MotoSPEC_Rake');
  // MotoSPEC_Rake deps on Rake_Static (leaf) and Pitch (intermediate);
  // Pitch deps on Travel_Front, Travel_Rear, WB (all leaves).
  assert.ok(leaves.includes('Rake_Static'));
  assert.ok(leaves.includes('Travel_Front'));
  assert.ok(leaves.includes('Travel_Rear'));
  assert.ok(leaves.includes('WB'));
  assert.ok(!leaves.includes('Pitch'), 'Pitch is intermediate, not a leaf');
  assert.ok(!leaves.includes('MotoSPEC_Rake'), 'self should not be in leaves');
});

test('leafDepsFor on a leaf-only result still returns the leaves', () => {
  const leaves = leafDepsFor('MotoSPEC_Trail');
  // MotoSPEC_Trail deps on Rf (leaf), MotoSPEC_Rake (intermediate, expands
  // to Rake_Static + Pitch's leaves), and O (intermediate aliasing
  // Yoke_Offset). The walker recurses through intermediates to leaves.
  assert.ok(leaves.includes('Rf'));
  assert.ok(leaves.includes('Yoke_Offset'));
  assert.ok(leaves.includes('Rake_Static'));
  // O is intermediate — it must NOT appear in the leaf set.
  assert.ok(!leaves.includes('O'), 'O is an intermediate channel, not a leaf');
});

import { isPlaceholderCoords } from '../src/data-table-advance.js';
import {
  LINKAGE_PLACEHOLDER_LINKED,
  LINKAGE_PLACEHOLDER_PROLINK,
} from '../src/linkage-setup.js';

test('isPlaceholderCoords: pro-link placeholder → true', () => {
  const inputs = { ...LINKAGE_PLACEHOLDER_PROLINK, Linkage_Mode: 'pro-link' };
  assert.equal(isPlaceholderCoords(inputs), true);
});

test('isPlaceholderCoords: linked placeholder → true', () => {
  const inputs = { ...LINKAGE_PLACEHOLDER_LINKED, Linkage_Mode: 'linked' };
  assert.equal(isPlaceholderCoords(inputs), true);
});

test('isPlaceholderCoords: customized coords → false', () => {
  const inputs = {
    ...LINKAGE_PLACEHOLDER_PROLINK,
    Linkage_Mode: 'pro-link',
    Frame_Rocker_Pivot_X: -123.45, // arbitrary non-placeholder value
  };
  assert.equal(isPlaceholderCoords(inputs), false);
});
