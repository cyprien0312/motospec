// ============================================================
// HIGHLITE (cross-column diff) + copy-settings-from-column
// ============================================================
//
// Both ported from real MotoSPEC (docs/research/motospec-v5-teardown.md
// §2.4–2.5). HIGHLITE marks SETTINGS that differ from a chosen reference
// column — never results, which are the consequence rather than the
// change. Copy moves only what the source column actually SET.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, blankBike, applyCopyScope, COPY_SCOPES, ROW_GROUPS } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';

const twoBikes = () => [blankBike(0), blankBike(1)];
const render = (bikes, extra = {}) =>
  renderDataTable({ values: defaultValues(), bikes, lang: 'en', ...extra });

// Count dt-diff cells in a rendered table.
const diffCount = (html) => (html.match(/class="[^"]*dt-diff[^"]*"/g) || []).length;

test('HIGHLITE off by default — no cell is marked', () => {
  assert.equal(diffCount(render(twoBikes())), 0);
});

test('HIGHLITE: identical columns produce no diffs even when active', () => {
  const bikes = twoBikes();
  assert.equal(diffCount(render(bikes, { dtHighlite: 0 })), 0);
});

test('HIGHLITE: a diverging setting is marked in the other column only', () => {
  const bikes = twoBikes();
  bikes[1].overrides = { Rear_Spring_Rate: 130 };
  const html = render(bikes, { dtHighlite: 0 });
  assert.equal(diffCount(html), 1, 'exactly the one diverging cell');
  // The reference column itself is never marked.
  assert.match(html, /dt-bike-head-ref/);
});

test('HIGHLITE: switching the reference column moves the marks, not the count', () => {
  const bikes = twoBikes();
  bikes[1].overrides = { Rear_Spring_Rate: 130 };
  assert.equal(diffCount(render(bikes, { dtHighlite: 0 })), 1);
  assert.equal(diffCount(render(bikes, { dtHighlite: 1 })), 1);
});

test('HIGHLITE: results rows are never marked — only settings', () => {
  // Change one setting; every downstream RESULTS value changes too, but
  // highlighting them would bury the one thing the user actually altered.
  const bikes = twoBikes();
  bikes[1].overrides = { Sag_Rear: 35 };
  const html = render(bikes, { dtHighlite: 0 });
  assert.equal(diffCount(html), 1);
});

test('HIGHLITE: an out-of-range reference index is ignored, not crashed on', () => {
  const bikes = twoBikes();
  assert.equal(diffCount(render(bikes, { dtHighlite: 9 })), 0);
  assert.equal(diffCount(render(bikes, { dtHighlite: -1 })), 0);
  assert.doesNotMatch(render(bikes, { dtHighlite: null }), /dt-diff/);
});

test('copy control: one "copy from" select per column, absent with a single column', () => {
  const html = render(twoBikes());
  assert.equal((html.match(/class="dt-copy"/g) || []).length, 2);
  assert.equal((render([blankBike(0)]).match(/class="dt-copy"/g) || []).length, 0);
});

test('copy control: offers every scope for every OTHER column', () => {
  const html = render(twoBikes());
  for (const scope of Object.keys(COPY_SCOPES)) {
    assert.match(html, new RegExp(`value="1:${scope}"`), `column 0 should offer ${scope} from column 1`);
    assert.match(html, new RegExp(`value="0:${scope}"`), `column 1 should offer ${scope} from column 0`);
  }
  // Never offers copying a column onto itself.
  const selects = [...html.matchAll(/<select class="dt-copy" onchange="copyBikeFrom\((\d+),[\s\S]*?<\/select>/g)];
  assert.equal(selects.length, 2);
  for (const m of selects) {
    const self = m[1];
    assert.doesNotMatch(m[0], new RegExp(`value="${self}:`),
      `column ${self}'s copy menu offers itself as a source`);
    assert.equal((m[0].match(/<optgroup/g) || []).length, 1, 'one source group per other column');
  }
});

test('copy front: moves front settings and the fork, leaves the rear alone', () => {
  const [dest, src] = twoBikes();
  src.overrides = { Front_Spring_Rate: 9.5, Rear_Spring_Rate: 130 };
  src.components = { fork: 'fgk242', shock: 'ya-589' };
  applyCopyScope(dest, src, 'front');
  assert.equal(dest.overrides.Front_Spring_Rate, 9.5);
  assert.equal(dest.components.fork, 'fgk242');
  assert.equal(dest.overrides.Rear_Spring_Rate, undefined);
  assert.equal(dest.components.shock, undefined);
});

test('copy rear: moves rear settings, shock and linkage, leaves the front alone', () => {
  const [dest, src] = twoBikes();
  src.overrides = { Front_Spring_Rate: 9.5, Rear_Spring_Rate: 130 };
  src.components = { fork: 'fgk242', shock: 'ya-589' };
  applyCopyScope(dest, src, 'rear');
  assert.equal(dest.overrides.Rear_Spring_Rate, 130);
  assert.equal(dest.components.shock, 'ya-589');
  assert.equal(dest.overrides.Front_Spring_Rate, undefined);
  assert.equal(dest.components.fork, undefined);
});

test('copy all: brings the chassis profile, both ends, load case and sprockets', () => {
  const [dest, src] = twoBikes();
  src.overrides = { Front_Spring_Rate: 9.5, Rear_Spring_Rate: 130, Sag_Rear: 33, Mass: 262 };
  src.components = { chassis: 'x', fork: 'fgk242', shock: 'ya-589', front_sprocket: 15 };
  applyCopyScope(dest, src, 'all');
  assert.equal(dest.components.chassis, 'x');
  assert.equal(dest.overrides.Sag_Rear, 33);
  assert.equal(dest.overrides.Mass, 262);
  assert.equal(dest.components.front_sprocket, 15);
});

test('copy CLEARS what the source never set — it never invents a binding', () => {
  // The destination had a fork bound and a spring typed; the source has
  // neither. After copying, the destination must be as unbound as the
  // source, or "copy" would silently keep stale values the user thinks
  // they just replaced.
  const [dest, src] = twoBikes();
  dest.overrides = { Front_Spring_Rate: 9.5 };
  dest.components = { fork: 'fgk242' };
  applyCopyScope(dest, src, 'front');
  assert.equal(dest.overrides.Front_Spring_Rate, undefined);
  assert.equal(dest.components.fork, undefined);
});

test('copy is a no-op on an unknown scope or a missing column', () => {
  const [dest, src] = twoBikes();
  dest.overrides = { Front_Spring_Rate: 9.5 };
  applyCopyScope(dest, src, 'nonsense');
  applyCopyScope(dest, null, 'front');
  assert.equal(dest.overrides.Front_Spring_Rate, 9.5);
});

test('COPY_SCOPES reference real group headers (so new rows copy automatically)', () => {
  const headers = new Set(ROW_GROUPS.map(g => g.header));
  for (const [scope, list] of Object.entries(COPY_SCOPES)) {
    for (const h of list) {
      assert.ok(headers.has(h), `${scope} references group "${h}" which no longer exists`);
    }
  }
  // Every settings group must be reachable via `all`, or copying a column
  // would leave part of the setup behind.
  const RESULT_ONLY = new Set(['RESULTS']);
  for (const g of ROW_GROUPS) {
    if (RESULT_ONLY.has(g.header)) continue;
    assert.ok(COPY_SCOPES.all.includes(g.header),
      `group "${g.header}" is not covered by the "all" copy scope`);
  }
});
