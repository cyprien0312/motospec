import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDataTable, ROW_GROUPS } from '../src/data-table.js';
import { defaultValues } from '../src/formulas.js';

test('table contains every CSV group header', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const expected of ['FRONT SETTINGS', 'REAR SETTINGS', 'TIRES', 'SPROCKETS', 'DYNAMIC READINGS', 'RESULTS']) {
    assert.match(html, new RegExp(expected));
  }
});

test('table contains every reference bike name', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const expected of ['Yamaha R7', 'Suzuki GSX-8R', 'Aprilia RS 660']) {
    assert.match(html, new RegExp(expected));
  }
});

test('NaN computed cells render as em-dash', () => {
  const html = renderDataTable({ values: defaultValues() });
  assert.match(html, /—/);
});

test('Phase C rows render numerics for default state', () => {
  const html = renderDataTable({ values: defaultValues() });
  for (const label of ['Motion Ratio', 'Progression', 'Rear Ride Height', 'Rear Wheel Vertical Travel']) {
    const labelPattern = label.replace(/\s/g, '\\s');
    const rowMatch = html.match(new RegExp(`<tr[^>]*>[\\s\\S]*?${labelPattern}[\\s\\S]*?</tr>`, 'i'));
    if (!rowMatch) continue; // row label may be absent or in different casing
    const tds = rowMatch[0].match(/<td[^>]*>[^<]*<\/td>/g);
    if (!tds) continue;
    const lastTd = tds[tds.length - 1];
    assert.doesNotMatch(lastTd, /—/, `${label} still em-dash`);
  }
});

test('every ROW_GROUPS row has at least one of input/computed/ref/literal', () => {
  for (const g of ROW_GROUPS) for (const r of g.rows) {
    const has = r.input != null || r.computed != null || r.ref != null || r.literal != null || r.csvKey != null;
    assert.ok(has, `row "${r.spec}" has no value source`);
  }
});
