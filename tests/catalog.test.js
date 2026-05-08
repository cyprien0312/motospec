// tests/catalog.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGS, CATALOG_KEYS,
  setCatalogEntry, patchCatalogEntry, removeCatalogEntry,
  getUserOverlay, applyUserOverlay, resetUserOverlay,
  materializeBikeInputs,
} from '../src/catalog.js';
import {
  slugifyLinkageName, buildLinkagePresetEntry, LINKAGE_SPEC_FIELDS,
} from '../src/linkage-setup.js';
import { defaultValues } from '../src/formulas.js';

beforeEach(() => resetUserOverlay());

test('baseline catalogs load with expected ids', () => {
  assert.ok(CATALOGS.forks.fgk242, 'fgk242 fork present');
  assert.ok(CATALOGS.shocks['ya-589'], 'ya-589 shock present');
  assert.equal(CATALOG_KEYS.length, 4);
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

test('slugifyLinkageName produces a clean slug and dedupes on collision', () => {
  assert.equal(slugifyLinkageName('My R7 Setup'), 'my-r7-setup');
  assert.equal(slugifyLinkageName('  Hello!! World  '), 'hello-world');
  assert.equal(slugifyLinkageName(''), 'linkage');
  // Collision → suffix appended.
  const id = slugifyLinkageName('Foo', new Set(['foo']));
  assert.notEqual(id, 'foo');
  assert.ok(id.startsWith('foo-'));
});

test('buildLinkagePresetEntry + setCatalogEntry round-trips the 12 linkage spec fields', () => {
  const v = defaultValues();
  // Tweak a coord so we can verify it survives the round-trip.
  v.Frame_Rocker_Pivot_X = -211;
  const entry = buildLinkagePresetEntry('My Linkage', v);
  assert.equal(entry.name, 'My Linkage');
  assert.equal(entry.manufacturer, 'User');
  assert.equal(entry.source, 'Saved from Linkage Setup');
  // All 12 spec fields present.
  for (const k of LINKAGE_SPEC_FIELDS) {
    assert.ok(k in entry.specs, `missing spec field ${k}`);
  }
  const id = slugifyLinkageName('My Linkage', new Set(Object.keys(CATALOGS.linkages)));
  setCatalogEntry('linkages', id, entry);
  const stored = CATALOGS.linkages[id];
  assert.ok(stored, `linkage ${id} not in CATALOGS.linkages`);
  assert.equal(stored.name, 'My Linkage');
  assert.equal(stored.specs.Frame_Rocker_Pivot_X, -211);
  assert.equal(stored.specs.Linkage_Mode, 'pro-link');
});
