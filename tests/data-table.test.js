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

test('every ROW_GROUPS row has at least one of input/computed/ref/literal', () => {
  for (const g of ROW_GROUPS) for (const r of g.rows) {
    const has = r.input != null || r.computed != null || r.ref != null || r.literal != null || r.csvKey != null;
    assert.ok(has, `row "${r.spec}" has no value source`);
  }
});
