// tests/catalog-editor.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCatalogEditor } from '../src/catalog-editor.js';
import { CATALOG_KEYS } from '../src/catalog.js';

test('editor renders for every catalog with a tab bar', () => {
  for (const key of CATALOG_KEYS) {
    const html = renderCatalogEditor({ catalogKey: key, lang: 'en' });
    assert.match(html, /class="cat-tabs"/, `${key} missing tab bar`);
    assert.match(html, /class="cat-table"/, `${key} missing table`);
    // The active tab matches the requested key
    assert.match(html, new RegExp(`setCatalogTab\\('${key}'\\)[^>]*>[^<]*</button>`));
  }
});

test('editor wires onchange to setCatalogField for each entry field', () => {
  const html = renderCatalogEditor({ catalogKey: 'forks', lang: 'en' });
  assert.match(html, /onchange="setCatalogField\('forks', 'fgk242', 'name'/);
  assert.match(html, /onchange="setCatalogField\('forks', 'fgk242', 'specs\.Front_Spring_Rate'/);
});

test('editor includes an Add row for new entries', () => {
  const html = renderCatalogEditor({ catalogKey: 'forks', lang: 'en' });
  assert.match(html, /id="cat-add-forks"/);
  assert.match(html, /addCatalogEntryUI\('forks'\)/);
});

test('editor renders in zh by default', () => {
  const html = renderCatalogEditor({ catalogKey: 'forks', lang: 'zh' });
  assert.match(html, /部件库/);
});
