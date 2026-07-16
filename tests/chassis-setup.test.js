import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChassisSetup, CHASSIS_GROUPS, CHASSIS_SPEC_FIELDS, OPTIONAL_CHASSIS_FIELDS, slugifyChassisName, buildChassisPresetEntry } from '../src/chassis-setup.js';
import { defaultValues } from '../src/formulas.js';

test('chassis-setup: renders every grouped field as an input', () => {
  const html = renderChassisSetup({ values: defaultValues(), lang: 'en' });
  for (const g of CHASSIS_GROUPS) {
    for (const f of g.fields) {
      assert.match(html, new RegExp(`oninput="setChassisInput\\('${f}'`),
        `missing input wired to setChassisInput for ${f}`);
    }
  }
});

test('chassis-setup: live readout strip surfaces Trail / W_F_Static / W_R_Static', () => {
  const html = renderChassisSetup({ values: defaultValues(), lang: 'en' });
  assert.match(html, /Static Trail/);
  assert.match(html, /Static Front Load/);
  assert.match(html, /Static Rear Load/);
  assert.match(html, /Σ Aero Share/);
});

test('chassis-setup: SVG diagram is present with annotations', () => {
  const html = renderChassisSetup({ values: defaultValues(), lang: 'en' });
  assert.match(html, /<svg[^>]*chassis-diagram/);
  // WB callout
  assert.match(html, /WB \d/);
  // β / Rake / H_CG / L_CG / Yoke labels
  assert.match(html, /β /);
  assert.match(html, /H_CG /);
  assert.match(html, /L_CG /);
  assert.match(html, /Yoke /);
});

test('slugifyChassisName: handles spaces and parens', () => {
  assert.equal(slugifyChassisName('Yamaha R7 (2022)'), 'yamaha-r7-2022');
  // Empty/whitespace falls back to a timestamped id
  assert.match(slugifyChassisName('  '), /^chassis-\d+$/);
});

test('buildChassisPresetEntry: derives rear_weight_dist + C_r_aero from primaries', () => {
  const v = { ...defaultValues(), front_weight_dist: 0.55, C_f_aero: 0.42 };
  const entry = buildChassisPresetEntry('Test Profile', v);
  assert.equal(entry.name, 'Test Profile');
  assert.equal(entry.specs.front_weight_dist, 0.55);
  assert.equal(entry.specs.rear_weight_dist, 0.45);
  assert.equal(entry.specs.C_f_aero, 0.42);
  assert.equal(entry.specs.C_r_aero, 0.58);
});

test('buildChassisPresetEntry: only emits CHASSIS_SPEC_FIELDS', () => {
  const v = { ...defaultValues(), Travel_Front: 99 };
  const entry = buildChassisPresetEntry('X', v);
  assert.ok(!('Travel_Front' in entry.specs), 'Travel_Front should not leak into a chassis profile');
  for (const f of CHASSIS_SPEC_FIELDS) {
    if (Number.isFinite(v[f])) assert.ok(f in entry.specs, `expected spec ${f}`);
  }
});

test('optional fields are never backfilled from defaults on save (zero-fake-data)', () => {
  const entry = buildChassisPresetEntry('Race Bike', { Rake_Static: 23.7, WB: 1414.3 });
  for (const f of OPTIONAL_CHASSIS_FIELDS) {
    assert.ok(!(f in entry.specs), `${f} must not be backfilled into a saved profile`);
  }
  // Geometry fields still complete via backfill
  assert.ok(Number.isFinite(entry.specs.Swingarm_Length));
  // Measured optional values DO round-trip
  const withMass = buildChassisPresetEntry('X', { Mass: 172, front_weight_dist: 0.51 });
  assert.equal(withMass.specs.Mass, 172);
  assert.equal(withMass.specs.rear_weight_dist, 0.49);
});

test('chassis page renders N/A placeholder and hides CG/chain when unmeasured', () => {
  const v = { Rake_Static: 23.7, WB: 1414.3, Swingarm_Length: 594.5, beta_static: 12.23, Rf: 304.6 };
  const html = renderChassisSetup({ values: v, lang: 'en' });
  assert.match(html, /N\/A — not measured/);
  assert.doesNotMatch(html, /H_CG \d/, 'CG annotation must not draw a fake CG');
  assert.doesNotMatch(html, />CG</, 'CG dot label must be hidden');
  assert.doesNotMatch(html, /F \d+% · R \d+%/, 'weight pill must be hidden');
});
