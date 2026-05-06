// tests/linkage-setup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLinkageSetup } from '../src/linkage-setup.js';
import { defaultValues } from '../src/formulas.js';

test('linkage-setup: page renders without crashing', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  assert.ok(html.length > 500, 'page suspiciously short');
});

test('linkage-setup: page contains all 10 coordinate inputs', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  for (const id of [
    'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
    'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
    'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
    'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
    'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
  ]) {
    assert.match(html, new RegExp(id), `missing input ${id}`);
  }
});

test('linkage-setup: page contains live readouts for derived metrics', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  for (const id of ['Motion_Ratio', 'Progression', 'Rear_Wheel_Vertical_Travel', 'Rear_Ride_Height']) {
    assert.match(html, new RegExp(`data-live="${id}"`), `missing live readout for ${id}`);
  }
});

test('linkage-setup: page contains an SVG', () => {
  const html = renderLinkageSetup({ values: defaultValues() });
  assert.match(html, /<svg/);
});

test('linkage-setup: page renders in english when state.lang === "en"', () => {
  const html = renderLinkageSetup({ values: defaultValues(), lang: 'en' });
  assert.match(html, /Frame Rocker Pivot/);
});
