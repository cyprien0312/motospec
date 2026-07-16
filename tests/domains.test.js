// ============================================================
// Definition-domain invariants
// ============================================================
//
// The user flow is: define chassis → define linkage → read the data
// table. These tests pin the contract that makes that flow honest:
//
//  1. The duplicated provider lists in data-table.js stay identical to
//     their sources of truth in chassis-setup.js / linkage-setup.js.
//  2. No input key is defined by more than one domain (chassis, linkage,
//     forks, shocks) — a key with two providers can be silently
//     redefined, which is exactly what the domains exist to prevent.
//  3. Every leaf input of every RESULTS row is supplied by a definition
//     domain (or is deliberately user-typed / always-ready) — no result
//     can depend on an input nothing is responsible for.

import { test } from 'node:test';
import assert from 'node:assert';

import { P } from '../src/formulas.js';
import { ROW_GROUPS, CHASSIS_PROVIDED, LINKAGE_PROVIDED, ALWAYS_READY } from '../src/data-table.js';
import { CHASSIS_SPEC_FIELDS } from '../src/chassis-setup.js';
import { LINKAGE_COORD_FIELDS } from '../src/linkage-setup.js';
import FORKS  from '../data/forks.json'  with { type: 'json' };
import SHOCKS from '../data/shocks.json' with { type: 'json' };

const setEq = (a, b, msg) =>
  assert.deepEqual([...a].sort(), [...b].sort(), msg);

const specKeys = (catalog) =>
  new Set(Object.values(catalog).flatMap(e => Object.keys(e.specs || {})));

const DOMAINS = {
  chassis: new Set(CHASSIS_PROVIDED),
  linkage: new Set(LINKAGE_PROVIDED),
  forks:   specKeys(FORKS),
  shocks:  specKeys(SHOCKS),
};

// Keys legitimately provided outside the catalogs.
const TYPED = new Set(['Front_Sprocket', 'Rear_Sprocket']);

test('CHASSIS_PROVIDED matches CHASSIS_SPEC_FIELDS exactly', () => {
  setEq(CHASSIS_PROVIDED, CHASSIS_SPEC_FIELDS,
    'data-table.js CHASSIS_PROVIDED drifted from chassis-setup.js CHASSIS_SPEC_FIELDS');
});

test('LINKAGE_PROVIDED matches LINKAGE_COORD_FIELDS exactly', () => {
  setEq(LINKAGE_PROVIDED, LINKAGE_COORD_FIELDS,
    'data-table.js LINKAGE_PROVIDED drifted from linkage-setup.js LINKAGE_COORD_FIELDS');
});

test('definition domains are pairwise disjoint (no key has two providers)', () => {
  const names = Object.keys(DOMAINS);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const overlap = [...DOMAINS[names[i]]].filter(k => DOMAINS[names[j]].has(k));
      assert.deepEqual(overlap, [],
        `${names[i]} and ${names[j]} both define: ${overlap.join(', ')}`);
    }
  }
  for (const [name, dom] of Object.entries(DOMAINS)) {
    const overlap = [...TYPED].filter(k => dom.has(k));
    assert.deepEqual(overlap, [], `${name} redefines typed key(s): ${overlap.join(', ')}`);
  }
});

// Transitive leaf-input walk over the P graph (mirrors data-table.js
// leafInputsFor, which is private).
function leaves(id, seen = new Set(), out = new Set()) {
  if (seen.has(id)) return out;
  seen.add(id);
  const p = P[id];
  if (!p || p.type === 'input' || !Array.isArray(p.deps) || p.deps.length === 0) {
    out.add(id);
    return out;
  }
  for (const d of p.deps) leaves(d, seen, out);
  return out;
}

test('every RESULTS leaf input has exactly one responsible provider', () => {
  for (const g of ROW_GROUPS) {
    for (const row of g.rows) {
      const ls = row.computed ? [...leaves(row.computed)]
               : row.derivedFrom ? (row.requires || [])
               : null;
      if (!ls) continue;
      for (const k of ls) {
        const providers = Object.entries(DOMAINS)
          .filter(([, dom]) => dom.has(k)).map(([n]) => n);
        if (TYPED.has(k)) providers.push('typed');
        if (ALWAYS_READY.has(k)) providers.push('always-ready');
        assert.equal(providers.length, 1,
          `${row.computed || row.spec}: leaf "${k}" has providers [${providers.join(', ')}] — expected exactly one`);
      }
    }
  }
});
