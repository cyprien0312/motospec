import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderUserGuide, GUIDE_ANCHORS } from '../src/user-guide.js';

test('user guide renders both languages', () => {
  for (const lang of ['zh', 'en']) {
    const html = renderUserGuide({ lang });
    assert.match(html, /<article class="guide-page">/);
    assert.match(html, /<nav class="guide-toc">/);
  }
});

test('user guide includes every advertised anchor', () => {
  const html = renderUserGuide({ lang: 'en' });
  for (const a of GUIDE_ANCHORS) {
    assert.match(html, new RegExp(`id="guide-${a}"`),
      `missing section anchor for "${a}"`);
    assert.match(html, new RegExp(`href="#guide-${a}"`),
      `missing TOC link for "${a}"`);
  }
});

test('user guide marks the requested anchor as focused', () => {
  const html = renderUserGuide({ lang: 'en', anchor: 'datatable' });
  // Only the requested section should carry the focused class.
  assert.match(html, /id="guide-datatable" class="guide-section focused"/);
  assert.doesNotMatch(html, /id="guide-chassis" class="guide-section focused"/);
});

test('user guide names the key concepts users need', () => {
  const en = renderUserGuide({ lang: 'en' });
  // Workflow keywords
  assert.match(en, /Save chassis profile/);
  assert.match(en, /Save as preset/);
  // Data-table missing-input hint contract
  assert.match(en, /Need: Fork specs/);
  // Status-badge explanations — the STATIC badge is retired (RESULTS is
  // a single live block), only PENDING remains documented
  assert.match(en, /PENDING/);
  assert.doesNotMatch(en, /dt-status-static/);
  // Sag load case
  assert.match(en, /Load case \/ Sag/);
  assert.match(en, /unloaded/);

  const zh = renderUserGuide({ lang: 'zh' });
  assert.match(zh, /保存为底盘配置/);
  assert.match(zh, /Need:/);
  assert.match(zh, /PENDING/);
  assert.doesNotMatch(zh, /dt-status-static/);
  assert.match(zh, /LOAD CASE/);
  assert.match(zh, /未加载参考态/);
});
