// ============================================================
// Catalog editor page — add/edit/delete component catalog entries
// ============================================================

import { CATALOGS, CATALOG_KEYS } from './catalog.js';

const CATALOG_LABELS = {
  forks:     { en: 'Forks',     zh: '前叉' },
  shocks:    { en: 'Shocks',    zh: '避震' },
  linkages:  { en: 'Linkages',  zh: '连杆' },
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// Spec keys for a catalog = union of `.specs` keys across its entries,
// preserving first-seen order (so rebuilds remain stable).
function specKeysFor(catalogKey) {
  const seen = new Set();
  const order = [];
  for (const entry of Object.values(CATALOGS[catalogKey] || {})) {
    for (const k of Object.keys(entry?.specs || {})) {
      if (!seen.has(k)) { seen.add(k); order.push(k); }
    }
  }
  return order;
}

// Top-level (non-spec) editable fields. Same set for every catalog.
const TOP_FIELDS = ['name', 'manufacturer'];

function entryRow(catalogKey, id, entry, specKeys) {
  const cells = [];
  cells.push(`<td class="cat-id"><code>${escapeHtml(id)}</code></td>`);
  for (const f of TOP_FIELDS) {
    const v = entry[f] ?? '';
    cells.push(
      `<td><input type="text" class="cat-input" value="${escapeHtml(v)}" ` +
      `onchange="setCatalogField('${catalogKey}', '${escapeHtml(id)}', '${f}', this.value)"></td>`
    );
  }
  for (const k of specKeys) {
    const v = entry.specs?.[k];
    const isNum = typeof v === 'number' || v == null;
    const type = isNum ? 'number' : 'text';
    const display = v == null ? '' : v;
    cells.push(
      `<td><input type="${type}" class="cat-input" value="${escapeHtml(display)}" step="any" ` +
      `onchange="setCatalogField('${catalogKey}', '${escapeHtml(id)}', 'specs.${k}', this.value)"></td>`
    );
  }
  cells.push(
    `<td><button class="cat-btn cat-btn-danger" ` +
    `onclick="removeCatalogEntryUI('${catalogKey}', '${escapeHtml(id)}')">×</button></td>`
  );
  return `<tr>${cells.join('')}</tr>`;
}

function newEntryRow(catalogKey, specKeys) {
  // Single "Add" row: id text input, blank cells, then a + button that
  // reads the id and creates an empty entry. The cells stay blank
  // because adding sets {name: id, specs: {}} as the seed.
  const skipCount = TOP_FIELDS.length + specKeys.length;
  const blanks = '<td></td>'.repeat(skipCount);
  return `
    <tr class="cat-add-row">
      <td><input type="text" class="cat-input" id="cat-add-${catalogKey}" placeholder="new-id"></td>
      ${blanks}
      <td><button class="cat-btn cat-btn-primary"
        onclick="addCatalogEntryUI('${catalogKey}')">+</button></td>
    </tr>`;
}

function tabBar(activeKey, lang) {
  return CATALOG_KEYS.map(k => {
    const label = CATALOG_LABELS[k]?.[lang] || k;
    const active = k === activeKey ? ' active' : '';
    return `<button class="cat-tab${active}" onclick="setCatalogTab('${k}')">${escapeHtml(label)}</button>`;
  }).join('');
}

export function renderCatalogEditor({ catalogKey, lang }) {
  const activeKey = CATALOG_KEYS.includes(catalogKey) ? catalogKey : CATALOG_KEYS[0];
  const lng = lang === 'en' ? 'en' : 'zh';
  const entries = Object.entries(CATALOGS[activeKey] || {});
  const specKeys = specKeysFor(activeKey);

  const headerCells = [
    `<th>${lng === 'en' ? 'ID (part code)' : 'ID（零件编号）'}</th>`,
    ...TOP_FIELDS.map(f => `<th>${f === 'name' ? (lng === 'en' ? 'Name' : '名称') : (lng === 'en' ? 'Manufacturer' : '厂商')}</th>`),
    ...specKeys.map(k => `<th><code>${escapeHtml(k)}</code></th>`),
    `<th></th>`,
  ].join('');

  const bodyRows = entries.map(([id, entry]) => entryRow(activeKey, id, entry, specKeys)).join('');

  const title = lng === 'en' ? 'Component Library' : '部件库';
  const help = lng === 'en'
    ? 'Edits persist in your browser. Use Export to share or back up.'
    : '编辑会保存在浏览器本地。使用导出功能可共享或备份。';

  return `
    <div class="cat-wrap">
      <div class="cat-header">
        <h1>${escapeHtml(title)}</h1>
        <div class="cat-actions">
          <button class="cat-btn" onclick="exportCatalogs()">${escapeHtml(lng === 'en' ? 'Export JSON' : '导出 JSON')}</button>
          <button class="cat-btn" onclick="importCatalogs()">${escapeHtml(lng === 'en' ? 'Import JSON' : '导入 JSON')}</button>
          <button class="cat-btn cat-btn-warn" onclick="resetCatalogs()">${escapeHtml(lng === 'en' ? 'Reset to baseline' : '重置')}</button>
        </div>
      </div>
      <p class="cat-help">${escapeHtml(help)}</p>
      <div class="cat-tabs">${tabBar(activeKey, lng)}</div>
      <table class="cat-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}${newEntryRow(activeKey, specKeys)}</tbody>
      </table>
    </div>
  `;
}
