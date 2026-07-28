// ============================================================
// Readiness follows the calculation actually taken
// ============================================================
//
// The dependency graph is worst-case: swingarm_delta_solve lists all ten
// linkage coordinates because it MIGHT need them. But when the shock
// delta is zero the swingarm does not move and CALC short-circuits to 0
// before touching a single coordinate — so demanding a linkage profile
// there blanks rake, trail and wheelbase on a chassis profile that can
// compute them perfectly well. `skipDepsWhen` lets a node say so.
//
// The rule that keeps this honest: the condition may only be trusted
// when the keys it reads are themselves bound. An unbound key still
// holds its INPUT_META default, and a default proves nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, blankBike, LINKAGE_PROVIDED } from '../src/data-table.js';
import { defaultValues, P, computeAll } from '../src/formulas.js';
import { setCatalogEntry, resetUserOverlay } from '../src/catalog.js';

const CHASSIS_ID = 'cond-test-chassis';
const SHOCK_MATCHED = 'cond-test-shock-matched';
const SHOCK_LONGER = 'cond-test-shock-longer';

// A complete chassis profile whose shock baseline is 293 mm.
const chassisSpecs = {
  Rake_Static: 24.03, WB: 1400.3, beta_static: 13.5,
  Swingarm_Length: 580, Swingarm_Length_ref: 580,
  Yoke_Offset: 30, Yoke_Offset_ref: 30,
  Fork_Position: 4, Fork_Position_ref: 4,
  Shock_Length_ref: 293, Rf: 304.46, Chain_Pitch: 15.875,
};

function seed() {
  resetUserOverlay();
  setCatalogEntry('chassis', CHASSIS_ID, { name: 'Cond Test', specs: chassisSpecs });
  setCatalogEntry('shocks', SHOCK_MATCHED, { name: 'Matched', specs: { Shock_Length: 293 } });
  setCatalogEntry('shocks', SHOCK_LONGER, { name: 'Longer', specs: { Shock_Length: 300 } });
}

const render = (components) => {
  const b = blankBike(0);
  b.components = components;
  return renderDataTable({ values: defaultValues(), bikes: [b], lang: 'en' });
};

// Pull one RESULTS row's rendered cell text. The label cell can contain
// markup of its own (mode rows carry a <select>), so match lazily up to
// the closing </th> rather than assuming the label is bare text.
function cellFor(html, label) {
  const re = new RegExp(`<tr><th class="dt-spec">${label}[\\s\\S]*?</th>([\\s\\S]*?)</tr>`);
  const m = html.match(re);
  if (!m) return null;
  return (m[1].match(/<span>([^<]*)<\/span>/) || [])[1] ?? null;
}

test('the rule is declared where the short-circuit actually lives', () => {
  const rule = P.swingarm_delta_solve.skipDepsWhen;
  assert.ok(rule, 'swingarm_delta_solve must declare skipDepsWhen');
  // Everything it offers to skip must genuinely be one of its deps…
  for (const d of rule.deps) {
    assert.ok(P.swingarm_delta_solve.deps.includes(d), `${d} is not a dep of the node`);
  }
  // …and it may only skip linkage coordinates, never the shock keys that
  // the condition itself reads.
  for (const d of rule.deps) assert.ok(LINKAGE_PROVIDED.has(d), `${d} is not a linkage coord`);
  for (const k of rule.requires) assert.ok(!rule.deps.includes(k), `${k} is both read and skipped`);
});

test('the condition matches the real short-circuit in CALC', () => {
  // If these ever diverge, readiness would green-light a cell the solver
  // cannot actually compute. Check the claim against the solver itself.
  const rule = P.swingarm_delta_solve.skipDepsWhen;
  const base = { ...defaultValues(), ...chassisSpecs, Shock_Length: 293, Shock_Clevis_RHA: 0 };
  assert.equal(rule.test(base), true);
  // With the condition true, the answer must be exactly 0 with NO linkage
  // coords present at all — proof the coordinates really are unused.
  const stripped = { ...base };
  for (const k of LINKAGE_PROVIDED) delete stripped[k];
  assert.equal(computeAll(stripped).swingarm_delta_solve, 0);

  // And when it is false, the coords ARE needed: without them the solve
  // cannot produce a finite answer.
  const off = { ...base, Shock_Length: 300 };
  assert.equal(rule.test(off), false);
  const strippedOff = { ...off };
  for (const k of LINKAGE_PROVIDED) delete strippedOff[k];
  assert.ok(!Number.isFinite(computeAll(strippedOff).swingarm_delta_solve));
});

test('chassis + matched shock computes rake/trail/wheelbase with no linkage', () => {
  seed();
  const html = render({ chassis: CHASSIS_ID, shock: SHOCK_MATCHED });
  for (const label of ['Rake', 'Ground Trail', 'Swingarm Angle', 'Wheelbase']) {
    const v = cellFor(html, label);
    assert.ok(v && !/Need:/.test(v), `${label} should compute, got "${v}"`);
  }
  // The exact MotoSPEC values for this bike, topped out.
  assert.equal(cellFor(html, 'Rake'), '24.03');
  assert.equal(cellFor(html, 'Ground Trail'), '102.9');
  assert.equal(cellFor(html, 'Wheelbase'), '1400.3');
  resetUserOverlay();
});

test('a genuinely different shock length brings the linkage requirement back', () => {
  seed();
  const html = render({ chassis: CHASSIS_ID, shock: SHOCK_LONGER });
  // 300 vs a 293 baseline is a real 7 mm delta: the swingarm moves, so
  // the linkage is needed and saying otherwise would be a lie.
  assert.match(cellFor(html, 'Rake'), /Need:.*Linkage coords/);
  resetUserOverlay();
});

test('without a shock bound the default length proves nothing — linkage still required', () => {
  seed();
  const html = render({ chassis: CHASSIS_ID });
  // Shock_Length falls back to its INPUT_META default (310), which is not
  // a measurement. The condition must NOT be evaluated on it.
  assert.match(cellFor(html, 'Rake'), /Need:/);
  resetUserOverlay();
});

test('rows that really do need the linkage are unaffected', () => {
  seed();
  const html = render({ chassis: CHASSIS_ID, shock: SHOCK_MATCHED });
  // Motion ratio differentiates the shock curve — no short-circuit exists
  // for it, so it must still ask for coordinates.
  assert.match(cellFor(html, 'Motion Ratio'), /Need:.*Linkage coords/);
  assert.match(cellFor(html, 'Rear Wheel Rate'), /Need:.*Linkage coords/);
  resetUserOverlay();
});

test('rear sag still needs the linkage even at zero shock delta', () => {
  // delta_beta_sag is trigonometry on the swingarm, but Rear Stroke Used
  // goes through shockLength() and cannot short-circuit.
  seed();
  const b = blankBike(0);
  b.components = { chassis: CHASSIS_ID, shock: SHOCK_MATCHED };
  b.overrides = { Sag_Rear: 30 };
  const html = renderDataTable({ values: defaultValues(), bikes: [b], lang: 'en' });
  assert.match(cellFor(html, 'Rear Stroke Used'), /Need:/);
  // Rake, however, still computes: rear sag rotates the swingarm by
  // arcsin(sag / L), which needs no linkage at all.
  assert.ok(!/Need:/.test(cellFor(html, 'Rake')));
  resetUserOverlay();
});
