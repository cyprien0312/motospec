import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChassisSetup, CHASSIS_GROUPS, CHASSIS_SPEC_FIELDS, OPTIONAL_CHASSIS_FIELDS, SETUP_MIRROR, slugifyChassisName, buildChassisPresetEntry } from '../src/chassis-setup.js';
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

test('chassis-setup: one input per setup quantity — live setup keys are not rendered', () => {
  const html = renderChassisSetup({ values: defaultValues(), lang: 'en' });
  // The page edits only the *_ref baselines; the live keys mirror them.
  // Rendering both would recreate the two-Yoke-Offset confusion.
  for (const live of Object.values(SETUP_MIRROR)) {
    assert.doesNotMatch(html, new RegExp(`setChassisInput\\('${live}'`),
      `${live} must not render — its baseline ${Object.keys(SETUP_MIRROR).find(r => SETUP_MIRROR[r] === live)} is the single input`);
  }
  const grouped = CHASSIS_GROUPS.flatMap(g => g.fields);
  for (const live of Object.values(SETUP_MIRROR)) {
    assert.ok(!grouped.includes(live), `${live} must not appear in CHASSIS_GROUPS`);
  }
  for (const ref of Object.keys(SETUP_MIRROR)) {
    assert.ok(grouped.includes(ref), `${ref} must remain the visible input`);
  }
});

test('buildChassisPresetEntry: live setup keys mirror the refs (zero-delta profile)', () => {
  // Stale live values in page state (e.g. from an old session where the
  // setup group was still editable) must never survive into a save.
  const entry = buildChassisPresetEntry('X', {
    ...defaultValues(),
    Yoke_Offset: 32, Yoke_Offset_ref: 26,
    Fork_Position: 5, Fork_Position_ref: 28,
    Swingarm_Length: 580, Swingarm_Length_ref: 594.5,
  });
  assert.equal(entry.specs.Yoke_Offset, 26);
  assert.equal(entry.specs.Fork_Position, 28);
  assert.equal(entry.specs.Swingarm_Length, 594.5);
  for (const [ref, live] of Object.entries(SETUP_MIRROR)) {
    assert.equal(entry.specs[live], entry.specs[ref], `${live} must equal ${ref} in a saved profile`);
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
