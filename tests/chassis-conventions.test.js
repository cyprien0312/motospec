// ============================================================
// Measurement conventions on the chassis profile
// ============================================================
//
// A setup number is only comparable to another setup number if both were
// taken the same way. These enums record HOW — never WHAT — and no
// formula reads them (docs/research/motospec-v5-teardown.md §2.8).
//
// The honesty contract mirrors the numeric side: an unstated convention
// stays absent rather than being defaulted into a claim, and recording a
// convention the geometry chain does not implement must say so out loud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderChassisSetup, CHASSIS_GROUPS, CHASSIS_SPEC_FIELDS,
  CHASSIS_ENUM_FIELDS, CHASSIS_ENUM_KEYS,
  chassisEnumLabel, chassisEnumIsUnmodelled, buildChassisPresetEntry,
} from '../src/chassis-setup.js';
import { renderDataTable, blankBike, CHASSIS_PROVIDED, ROW_GROUPS } from '../src/data-table.js';
import { defaultValues, P, INPUT_META } from '../src/formulas.js';
import { setCatalogEntry, resetUserOverlay } from '../src/catalog.js';

test('every enum defaults to "not recorded" and offers it as an option', () => {
  for (const key of CHASSIS_ENUM_KEYS) {
    const def = CHASSIS_ENUM_FIELDS[key];
    assert.equal(def.def, '', `${key} must default to unrecorded`);
    assert.ok(def.options.some(o => o.value === ''), `${key} needs a "not recorded" option`);
    assert.ok(def.options.length >= 3, `${key} should list the real alternatives`);
    for (const o of def.options) {
      assert.ok(o.en && o.zh, `${key} option "${o.value}" missing a bilingual label`);
    }
  }
});

test('every enum names exactly one implemented convention, and it is a real option', () => {
  for (const key of CHASSIS_ENUM_KEYS) {
    const def = CHASSIS_ENUM_FIELDS[key];
    assert.ok(def.implemented, `${key} must declare which convention the math assumes`);
    assert.ok(def.options.some(o => o.value === def.implemented),
      `${key}.implemented is not one of its options`);
    assert.equal(chassisEnumIsUnmodelled(key, def.implemented), false);
  }
});

test('conventions are metadata: no formula reads them, no INPUT_META entry', () => {
  for (const key of CHASSIS_ENUM_KEYS) {
    assert.equal(P[key], undefined, `${key} must not be a parameter-graph node`);
    assert.equal(INPUT_META[key], undefined, `${key} is a string, not a numeric input`);
    for (const node of Object.values(P)) {
      assert.ok(!(node.deps || []).includes(key), `${node.name} depends on convention ${key}`);
    }
  }
});

test('conventions stay out of the numeric definition domain', () => {
  // CHASSIS_PROVIDED/CHASSIS_SPEC_FIELDS gate RESULTS readiness; a string
  // convention must never be able to block or unblock a computed cell.
  for (const key of CHASSIS_ENUM_KEYS) {
    assert.ok(!CHASSIS_SPEC_FIELDS.includes(key));
    assert.ok(!CHASSIS_PROVIDED.has(key));
  }
});

test('chassisEnumLabel resolves stored values, returns null for unknown/blank', () => {
  assert.equal(chassisEnumLabel('Swingarm_Length_Ref_Type', 'frame_center', 'en'),
    'Frame Center → Rear Axle');
  assert.ok(chassisEnumLabel('Swingarm_Length_Ref_Type', 'frame_center', 'zh').includes('车架中心'));
  assert.equal(chassisEnumLabel('Swingarm_Length_Ref_Type', '', 'en'), null);
  assert.equal(chassisEnumLabel('Swingarm_Length_Ref_Type', 'made_up', 'en'), null);
  assert.equal(chassisEnumLabel('No_Such_Field', 'x', 'en'), null);
});

test('chassisEnumIsUnmodelled flags a convention the math does not implement', () => {
  assert.equal(chassisEnumIsUnmodelled('Swingarm_Length_Ref_Type', 'swingarm_pivot'), false);
  assert.equal(chassisEnumIsUnmodelled('Swingarm_Length_Ref_Type', 'frame_center'), true);
  // Unrecorded is not "unmodelled" — it's simply unstated.
  assert.equal(chassisEnumIsUnmodelled('Swingarm_Length_Ref_Type', ''), false);
});

test('save: an unstated convention is absent from the profile, not defaulted', () => {
  const entry = buildChassisPresetEntry('X', defaultValues());
  for (const key of CHASSIS_ENUM_KEYS) {
    assert.ok(!(key in entry.specs), `${key} was written into a profile nobody stated it for`);
  }
});

test('save: a stated convention round-trips onto the profile', () => {
  const entry = buildChassisPresetEntry('X', {
    ...defaultValues(),
    Fork_Position_Ref_Type: 'lower_headstock_to_axle',
    Swingarm_Length_Ref_Type: 'frame_center',
  });
  assert.equal(entry.specs.Fork_Position_Ref_Type, 'lower_headstock_to_axle');
  assert.equal(entry.specs.Swingarm_Length_Ref_Type, 'frame_center');
  assert.ok(!('Rear_RH_Ref_Type' in entry.specs), 'the one left unstated stays absent');
});

test('chassis page renders each convention as a select with all its options', () => {
  const html = renderChassisSetup({ values: defaultValues(), lang: 'en' });
  const group = CHASSIS_GROUPS.find(g => g.kind === 'enum');
  assert.ok(group, 'a conventions group must exist');
  for (const key of group.fields) {
    assert.match(html, new RegExp(`setChassisEnum\\('${key}'`));
    for (const o of CHASSIS_ENUM_FIELDS[key].options) {
      assert.match(html, new RegExp(`value="${o.value}"`), `${key} missing option ${o.value || '(blank)'}`);
    }
  }
  // Nothing is flagged as unmodelled while everything is unrecorded.
  assert.doesNotMatch(html, /chassis-enum-warn/);
});

test('chassis page warns when the recorded convention is not the modelled one', () => {
  const html = renderChassisSetup({
    values: { ...defaultValues(), Swingarm_Length_Ref_Type: 'frame_center' },
    lang: 'en',
  });
  assert.match(html, /chassis-enum-warn/);
  assert.match(html, /not modelled/);
});

test('data table echoes the convention from the selected chassis profile', () => {
  resetUserOverlay();
  setCatalogEntry('chassis', 'conv-test', {
    name: 'Conv Test',
    specs: {
      ...Object.fromEntries(CHASSIS_SPEC_FIELDS.map(f => [f, INPUT_META[f]?.def ?? 0])),
      Swingarm_Length_Ref_Type: 'frame_center',
    },
  });
  const bike = blankBike(0);
  bike.components = { chassis: 'conv-test' };
  const html = renderDataTable({ values: defaultValues(), bikes: [bike], lang: 'en' });
  assert.match(html, /Frame Center → Rear Axle/);
  assert.match(html, /\(not modelled\)/);
  resetUserOverlay();
});

test('data table: no chassis profile → convention row asks for one', () => {
  const html = renderDataTable({ values: defaultValues(), bikes: [blankBike(0)], lang: 'en' });
  const rows = ROW_GROUPS.flatMap(g => g.rows).filter(r => r.enum);
  assert.equal(rows.length, CHASSIS_ENUM_KEYS.length, 'every convention should have a table row');
  assert.match(html, /Fork Position Reference/);
  assert.match(html, /Need: Chassis profile/);
});

test('data table: profile without a recorded convention shows a dash, not a guess', () => {
  resetUserOverlay();
  setCatalogEntry('chassis', 'bare', {
    name: 'Bare',
    specs: Object.fromEntries(CHASSIS_SPEC_FIELDS.map(f => [f, INPUT_META[f]?.def ?? 0])),
  });
  const bike = blankBike(0);
  bike.components = { chassis: 'bare' };
  const html = renderDataTable({ values: defaultValues(), bikes: [bike], lang: 'en' });
  assert.match(html, /Measurement convention not recorded/);
  assert.doesNotMatch(html, /Swingarm Pivot → Rear Axle/);
  resetUserOverlay();
});
