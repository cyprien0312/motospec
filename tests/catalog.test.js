// tests/catalog.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGS, CATALOG_KEYS,
  setCatalogEntry, patchCatalogEntry, removeCatalogEntry,
  getUserOverlay, applyUserOverlay, resetUserOverlay,
  materializeBikeInputs,
} from '../src/catalog.js';

beforeEach(() => resetUserOverlay());

test('baseline catalogs load with expected ids', () => {
  assert.ok(CATALOGS.forks.fgk242, 'fgk242 fork present');
  assert.ok(CATALOGS.shocks['ya-589'], 'ya-589 shock present');
  assert.equal(CATALOG_KEYS.length, 6);
});

test('setCatalogEntry adds a new entry visible in CATALOGS', () => {
  setCatalogEntry('forks', 'custom-fork', { name: 'Custom', specs: { Front_Spring_Rate: 9.2 } });
  assert.ok(CATALOGS.forks['custom-fork']);
  assert.equal(CATALOGS.forks['custom-fork'].specs.Front_Spring_Rate, 9.2);
});

test('patchCatalogEntry edits a single spec without dropping siblings', () => {
  const before = CATALOGS.forks.fgk242.specs;
  patchCatalogEntry('forks', 'fgk242', 'specs.Front_Spring_Rate', 9.5);
  assert.equal(CATALOGS.forks.fgk242.specs.Front_Spring_Rate, 9.5);
  // Other spec keys preserved
  assert.equal(CATALOGS.forks.fgk242.specs.Front_Oil_Level, before.Front_Oil_Level);
});

test('removeCatalogEntry tombstones a baseline entry', () => {
  removeCatalogEntry('forks', 'fgk242');
  assert.ok(!CATALOGS.forks.fgk242, 'fgk242 hidden after tombstone');
  // Other baseline forks still visible
  assert.ok(CATALOGS.forks['fl-23030']);
});

test('removeCatalogEntry on user-only entry removes it cleanly', () => {
  setCatalogEntry('forks', 'temp', { name: 'temp', specs: {} });
  assert.ok(CATALOGS.forks.temp);
  removeCatalogEntry('forks', 'temp');
  assert.ok(!CATALOGS.forks.temp);
});

test('getUserOverlay → applyUserOverlay round-trips edits', () => {
  setCatalogEntry('forks', 'roundtrip', { name: 'RT', specs: { Front_Spring_Rate: 8 } });
  patchCatalogEntry('shocks', 'ya-589', 'specs.Rear_Spring_Rate', 99);
  const exported = getUserOverlay();

  resetUserOverlay();
  assert.ok(!CATALOGS.forks.roundtrip, 'reset cleared overlay');
  assert.notEqual(CATALOGS.shocks['ya-589'].specs.Rear_Spring_Rate, 99);

  applyUserOverlay(exported);
  assert.equal(CATALOGS.forks.roundtrip.specs.Front_Spring_Rate, 8);
  assert.equal(CATALOGS.shocks['ya-589'].specs.Rear_Spring_Rate, 99);
});

test('materializeBikeInputs picks up overlay edits', () => {
  patchCatalogEntry('forks', 'fgk242', 'specs.Front_Spring_Rate', 11.1);
  const bike = {
    components: { fork: 'fgk242' },
    geometry: {}, environment: {}, setup: {},
  };
  const inputs = materializeBikeInputs(bike);
  assert.equal(inputs.Front_Spring_Rate, 11.1);
});
