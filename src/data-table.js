// ============================================================
// MotoSPEC Data Table view — editable per-bike profiles
// Mirrors motospec-style-table.csv structure
// ============================================================

import { computeAll, INPUT_META, defaultValues, P } from './formulas.js';
import { REFERENCE_BIKES } from './reference-bikes.js';
import { CATALOGS } from './catalog.js';

// Walk P[id].deps transitively to all leaf inputs the formula consumes.
// Used to decide whether a RESULTS cell can be computed for a given bike,
// or should be left blank because some required input isn't bound to any
// component / chassis profile / user override.
const _leafCache = new Map();
function leafInputsFor(id) {
  if (_leafCache.has(id)) return _leafCache.get(id);
  const out = new Set();
  const seen = new Set();
  const walk = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    const p = P[k];
    if (!p) { out.add(k); return; }
    if (p.type === 'input' || !Array.isArray(p.deps) || p.deps.length === 0) {
      out.add(k); return;
    }
    for (const d of p.deps) walk(d);
  };
  walk(id);
  _leafCache.set(id, out);
  return out;
}

// Inputs that a saved Chassis profile contributes (matches
// CHASSIS_SPEC_FIELDS in chassis-setup.js). Duplicated here to keep
// data-table.js free of cross-file imports — tests/domains.test.js
// asserts the two lists stay identical.
export const CHASSIS_PROVIDED = new Set([
  'Rake_Static','WB','Swingarm_Length','beta_static',
  'Yoke_Offset','Fork_Position',
  'Fork_Position_ref','Fork_Length_ref','Shock_Length_ref',
  'Mass','H_CG','L_CG','front_weight_dist','rear_weight_dist',
  'C_f_aero','C_r_aero','Rf',
  'Front_Sprocket_X','Front_Sprocket_Y','Chain_Pitch',
]);

// Inputs that a saved Linkage profile contributes (matches
// LINKAGE_COORD_FIELDS in linkage-setup.js; Linkage_Mode is non-numeric
// and never gates readiness). Same duplication contract as above —
// guarded by tests/domains.test.js.
export const LINKAGE_PROVIDED = new Set([
  'Frame_Rocker_Pivot_X','Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X','Rocker_To_Shock_Y',
  'Rocker_To_Drag_X','Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X','Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X','Frame_Shock_Top_Y',
]);

// Reverse-index: input-key → which component can supply it. Built fresh
// per render so user-added catalog entries get picked up. Chassis fields
// are seeded from CHASSIS_PROVIDED since `data/chassis.json` ships empty.
function buildProviderMap() {
  const m = {};
  for (const cat of Object.keys(CATALOGS)) {
    if (cat === 'chassis') continue;
    for (const entry of Object.values(CATALOGS[cat] || {})) {
      for (const k of Object.keys(entry?.specs || {})) {
        if (!m[k]) m[k] = cat;
      }
    }
  }
  for (const k of CHASSIS_PROVIDED) m[k] = 'chassis';
  // Seed linkage coords too — data/linkages.json also ships empty, and
  // without this a fresh install mislabels missing coords as "dynamic".
  for (const k of LINKAGE_PROVIDED) if (!m[k]) m[k] = 'linkages';
  m.Front_Sprocket = 'sprocket';
  m.Rear_Sprocket  = 'sprocket';
  return m;
}

const PROVIDER_LABELS = {
  chassis:  { zh: 'Chassis 配置',  en: 'Chassis profile' },
  forks:    { zh: 'Fork 规格',     en: 'Fork specs' },
  shocks:   { zh: 'Shock 规格',    en: 'Shock specs' },
  linkages: { zh: 'Linkage 坐标',  en: 'Linkage coords' },
  sprocket: { zh: '链轮齿数',      en: 'Sprocket teeth' },
  dynamic:  { zh: '动态量（未支持）', en: 'Dynamic input (not wired)' },
};

// Group missing leaves by which component can supply them, return an
// object suitable for rendering both a short visible hint and a verbose
// tooltip.
function summarizeMissing(missing, providerMap, lang) {
  const groups = new Map();
  for (const k of missing) {
    const prov = providerMap[k] || 'dynamic';
    if (!groups.has(prov)) groups.set(prov, []);
    groups.get(prov).push(k);
  }
  const ordered = ['chassis','forks','shocks','linkages','sprocket','dynamic']
    .filter(p => groups.has(p));
  const shortLabel = (lang === 'en' ? 'Need: ' : '缺：') +
    ordered.map(p => PROVIDER_LABELS[p][lang]).join(' · ');
  const verbose = ordered.map(p =>
    `${PROVIDER_LABELS[p][lang]}（${groups.get(p).join(', ')}）`
  ).join('\n');
  return { shortLabel, verbose };
}

// Set of inputs that the bike has *actually been given* (by chassis /
// component selection or by the user typing into a cell). Inputs absent
// from this set fall back to defaultValues() for compute safety, but the
// corresponding RESULTS cells render blank — we don't pretend a number is
// real when its inputs are placeholders.
// Inputs whose default value (typically 0 = "no adjustment") is itself a
// meaningful real-world value. They stay "ready" even when the user
// hasn't typed anything, so RESULTS that depend on them don't get
// incorrectly tagged as needing input.
export const ALWAYS_READY = new Set([
  'Shock_Clevis_RHA',
  // Sag defaults to 0 = "no load applied" — physically true, not a placeholder.
  'Sag_Front',
  'Sag_Rear',
]);

function bikeReadyKeys(bike) {
  const keys = new Set(ALWAYS_READY);
  // Each chosen component contributes its spec keys.
  for (const compKey of Object.keys(COMPONENT_TO_CATALOG)) {
    const cid = bike?.components?.[compKey];
    if (!cid) continue;
    const catName = COMPONENT_TO_CATALOG[compKey];
    const entry = (CATALOGS[catName] || {})[cid];
    if (!entry?.specs) continue;
    for (const k of Object.keys(entry.specs)) keys.add(k);
  }
  // Sprocket teeth count is stored on `components`, not on a catalog.
  if (bike?.components?.front_sprocket != null) keys.add('Front_Sprocket');
  if (bike?.components?.rear_sprocket  != null) keys.add('Rear_Sprocket');
  // Per-bike user overrides (typed into a cell). Chassis-domain keys are
  // excluded: they can only come from a chassis profile (single source of
  // definition), so a legacy override must neither mark them ready nor
  // feed the compute (see effectiveBikeValues).
  for (const k of Object.keys(bike?.overrides || {})) {
    if (!CHASSIS_PROVIDED.has(k)) keys.add(k);
  }
  return keys;
}

// Rebuild a bike's input dict from the LIVE catalogs on every render:
// defaults → chassis specs → fork/shock/linkage specs → sprocket teeth →
// non-chassis user overrides. `bike.values` is deliberately NOT read —
// it holds a copy taken at selection time, and computing from it lets a
// later catalog edit silently diverge from what the cells claim.
export function effectiveBikeValues(bike) {
  const v = defaultValues();
  for (const compKey of Object.keys(COMPONENT_TO_CATALOG)) {
    const cid = bike?.components?.[compKey];
    if (!cid) continue;
    const entry = (CATALOGS[COMPONENT_TO_CATALOG[compKey]] || {})[cid];
    if (entry?.specs) Object.assign(v, entry.specs);
  }
  if (bike?.components?.front_sprocket != null) v.Front_Sprocket = bike.components.front_sprocket;
  if (bike?.components?.rear_sprocket  != null) v.Rear_Sprocket  = bike.components.rear_sprocket;
  for (const [k, val] of Object.entries(bike?.overrides || {})) {
    if (!CHASSIS_PROVIDED.has(k)) v[k] = val;
  }
  return v;
}

// Rows tagged with `component: 'fork' | 'shock' | …` render as a
// <select> sourced from the matching catalog. Rows tagged with `input:`
// remain editable number inputs. The RESULTS group is rendered as
// computed read-only cells.
export const ROW_GROUPS = [
  { header: 'FRAME GEOMETRY', header_zh: '车架几何', rows: [
    { spec: 'Chassis',                                              spec_zh: '底盘',                 component: 'chassis' },
    { spec: 'Front Weight Distribution',                            spec_zh: '前轮静态重量分配',    input: 'front_weight_dist' },
    { spec: 'Rear Weight Distribution',                             spec_zh: '后轮静态重量分配',    input: 'rear_weight_dist' },
    { spec: 'Front Aero Downforce Share',                           spec_zh: '前轮气动下压力分配',  input: 'C_f_aero' },
    { spec: 'Rear Aero Downforce Share',                            spec_zh: '后轮气动下压力分配',  input: 'C_r_aero' },
  ]},
  { header: 'FRONT SETTINGS', header_zh: '前部设置', rows: [
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移量 (mm)',    input: 'Yoke_Offset' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position', status: 'pending' },
    { spec: 'Fork',                                                 spec_zh: '前叉',                 component: 'fork' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '前叉弹簧刚度 (N/mm)',  input: 'Front_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '前叉弹簧预压 (mm)',    input: 'Front_Spring_Preload', status: 'pending' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '前叉油位 (mm)',        input: 'Front_Oil_Level', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '前叉回顶弹簧刚度 (N/mm)', input: 'Front_Topout_Rate', status: 'pending' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '前叉回顶弹簧长度 (mm)', input: 'Front_Topout_Length', status: 'pending' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '后避震Clevis调整 (mm)', input: 'Shock_Clevis_RHA' },
    { spec: 'Shock',                                                spec_zh: '避震',                 component: 'shock' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '后避震长度 (mm)',      input: 'Shock_Length', status: 'pending' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '后避震弹簧刚度 (N/mm)', input: 'Rear_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '后避震弹簧预压 (mm)',  input: 'Rear_Spring_Preload', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '后避震回顶刚度 (N/mm)', input: 'Rear_Topout_Rate', status: 'pending' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '后避震回顶长度 (mm)',  input: 'Rear_Topout_Length', status: 'pending' },
    { spec: 'Linkage',                                              spec_zh: '连杆',                 component: 'linkage' },
  ]},
  { header: 'SPROCKETS', header_zh: '链轮', rows: [
    { spec: 'Front Sprocket',                                       spec_zh: '前链轮齿数',          input: 'Front_Sprocket' },
    { spec: 'Rear Sprocket',                                        spec_zh: '后链轮齿数',          input: 'Rear_Sprocket' },
    { spec: 'Final Ratio',                                          spec_zh: '最终传动比',          computed: 'Final_Ratio' },
  ]},
  { header: 'RESULTS', header_zh: '结果', rows: [
    { spec: 'Rake (degrees)',                                       spec_zh: '后倾角 (度)',         computed: 'MotoSPEC_Rake',              status: 'static' },
    { spec: 'Normal Trail (mm)',                                    spec_zh: '法向拖曳距 (mm)',     computed: 'Normal_Trail' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '拖曳距 (mm)',         computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角度 (度)',       computed: 'Swingarm_Angle' },
    { spec: 'Anti-Squat (%)',                                       spec_zh: '抗蹲百分比 (%)',      computed: 'Anti_Squat' },
    { spec: 'Progression (% Full Shock Travel)',                    spec_zh: '渐进性 (%)',          computed: 'Progression' },
    { spec: 'Motion Ratio (Wheel/Shock)',                           spec_zh: '运动比 (轮/避震)',    computed: 'Motion_Ratio' },
    { spec: 'Wheelbase (mm)',                                       spec_zh: '轴距 (mm)',           computed: 'WB',                         status: 'static' },
    { spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate' },
    { spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate' },
    { spec: 'CofG % Front',                                         spec_zh: '重心前侧占比 (%)',    derivedFrom: v => v.front_weight_dist * 100, requires: ['front_weight_dist'], status: 'static' },
    { spec: 'CofG % Rear',                                          spec_zh: '重心后侧占比 (%)',    derivedFrom: v => v.rear_weight_dist * 100,  requires: ['rear_weight_dist'],  status: 'static' },
  ]},
];

const STATUS_BADGE = {
  pending: { en: 'PENDING', zh: '待实现', title_en: 'Input is not yet consumed by any RESULTS formula', title_zh: '该输入尚未被任何 RESULTS 公式消费' },
  static:  { en: 'STATIC',  zh: '静态值', title_en: 'Echoes the static input value verbatim — does not respond to dynamic compression/load', title_zh: '直接回显静态输入值，不随动态压缩/载荷变化' },
};

const DASH = '—';

// component bike-key → catalog name
export const COMPONENT_TO_CATALOG = {
  chassis: 'chassis',
  fork: 'forks',
  shock: 'shocks',
  linkage: 'linkages',
};

// All component keys appearing on bike rows (for tests / introspection).
export const COMPONENT_FIELDS = Object.keys(COMPONENT_TO_CATALOG);

export function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

export function catalogEntriesFor(componentKey) {
  const catalogName = COMPONENT_TO_CATALOG[componentKey];
  const catalog = CATALOGS[catalogName] || {};
  return Object.entries(catalog);
}

export const MAX_BIKES = 5;

export function defaultBikes() {
  return REFERENCE_BIKES.map((b, i) => {
    const baseValues = defaultValues();
    const values = { ...baseValues, ...(b.inputs || {}) };
    return {
      id: `col-${i}`,
      name: b.name,
      values,
      components: { ...(b.components || {}) },
      overrides: {},
    };
  });
}

// Build a fresh blank bike with default values for new columns.
export function blankBike(idx) {
  return {
    id: `col-${idx}-${Date.now()}`,
    name: `Bike ${String.fromCharCode(65 + idx)}`,
    values: defaultValues(),
    components: {},
    overrides: {},
  };
}

function inputCell(bikeIdx, key, value, missingTitle) {
  const m = INPUT_META[key] || {};
  const step = m.step != null ? m.step : 'any';
  const minAttr = m.min != null ? ` min="${m.min}"` : '';
  const maxAttr = m.max != null ? ` max="${m.max}"` : '';
  const v = value == null || !Number.isFinite(value) ? '' : value;
  const titleAttr = missingTitle ? ` title="${escapeHtml(missingTitle)}"` : '';
  const cls = missingTitle ? 'dt-input dt-input-missing' : 'dt-input';
  return `<td><input type="number" class="${cls}" value="${v}" step="${step}"${minAttr}${maxAttr}${titleAttr} oninput="setBikeInput(${bikeIdx}, '${key}', this.value)"></td>`;
}

function componentCell(bikeIdx, componentKey, currentId, lang) {
  const entries = catalogEntriesFor(componentKey);
  const placeholderLabel = lang === 'en' ? '— pick —' : '— 选择 —';
  const placeholderSel = currentId ? '' : ' selected';
  const placeholderOpt = `<option value=""${placeholderSel}>${escapeHtml(placeholderLabel)}</option>`;
  const optionsHtml = entries.map(([id, entry]) => {
    const sel = id === currentId ? ' selected' : '';
    const label = entry.name || id;
    return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(label)}</option>`;
  }).join('');
  return `<td><select class="dt-input" onchange="setBikeComponent(${bikeIdx}, '${componentKey}', this.value)">${placeholderOpt}${optionsHtml}</select></td>`;
}

function readonlyCell(value) {
  return `<td class="dt-readonly"><span>${escapeHtml(value)}</span></td>`;
}

function literalCell(text) {
  return `<td class="dt-readonly"><span>${escapeHtml(text)}</span></td>`;
}

export function renderDataTable(state) {
  const lang = state?.lang || 'zh';
  const bikes = (state && Array.isArray(state.bikes) && state.bikes.length >= 0 && state.bikes.length <= MAX_BIKES)
    ? state.bikes
    : defaultBikes();

  // Materialize each bike from the live catalogs (not the stale copy in
  // bike.values) so the table always computes with what the chassis /
  // linkage / part definitions say right now.
  const effVals = bikes.map(effectiveBikeValues);
  const outs = effVals.map(v => computeAll({ ...v }));
  // Per-bike set of inputs that are actually bound (env / catalog /
  // override). RESULTS cells whose leaf inputs aren't all bound render
  // blank — we don't show numbers built from placeholder defaults.
  const readyByBike = bikes.map(bikeReadyKeys);
  const providerMap = buildProviderMap();
  // For a given row + per-bike ready-set, return either { ready: true }
  // or { ready: false, missing: [...leafKeys] } so the caller can render
  // a "what's missing" hint on the blank cell.
  const cellStatus = (row, ready) => {
    let leaves;
    if (row.computed) leaves = leafInputsFor(row.computed);
    else if (row.derivedFrom) leaves = new Set(row.requires || []);
    else return { ready: true };
    const missing = [];
    for (const k of leaves) if (!ready.has(k)) missing.push(k);
    return missing.length === 0 ? { ready: true } : { ready: false, missing };
  };
  const blankCellHTML = (missing) => {
    const { shortLabel, verbose } = summarizeMissing(missing, providerMap, lang);
    return `<td class="dt-readonly dt-missing" title="${escapeHtml(verbose)}"><span>${escapeHtml(shortLabel)}</span></td>`;
  };
  const inputMissingTitle = (key) => {
    const prov = providerMap[key];
    if (!prov || prov === 'dynamic') {
      return lang === 'en' ? 'Type a value, or leave blank' : '直接输入数值，或留空';
    }
    const label = PROVIDER_LABELS[prov][lang];
    return lang === 'en'
      ? `Type a value, or load it from a ${label}`
      : `直接输入数值，或从 ${label} 加载`;
  };

  const removeTitle = lang === 'en' ? 'Remove this column' : '删除该列';
  const addLabel    = lang === 'en' ? '+ Add Bike' : '+ 新增车型';
  const emptyHint   = lang === 'en'
    ? 'No bikes yet — click "+ Add Bike" above to start a comparison column.'
    : '当前没有车型——点击上方"+ 新增车型"添加对比列。';

  const bikeHeaders = bikes.map((b, i) =>
    `<th class="dt-bike-head">
      <button class="dt-col-remove" title="${escapeHtml(removeTitle)}" onclick="removeBike(${i})">×</button>
      <input type="text" class="dt-input dt-bike-name" value="${escapeHtml(b.name)}" onchange="setBikeName(${i}, this.value)">
    </th>`
  ).join('');
  const addHeader = bikes.length < MAX_BIKES
    ? `<th class="dt-bike-add"><button class="dt-col-add" onclick="addBike()">${escapeHtml(addLabel)}</button></th>`
    : '';
  const specHeader = lang === 'en' ? 'Parameter' : '参数';
  // Group rows span Parameter + all bike columns (the optional "+ Add" header
  // sits in its own column on the header row only).
  const groupColspan = 1 + bikes.length;

  if (bikes.length === 0) {
    return `
      <div class="dt-wrap">
        <div class="dt-empty"><button class="dt-col-add" onclick="addBike()">${escapeHtml(addLabel)}</button></div>
        <p class="dt-empty-hint">${escapeHtml(emptyHint)}</p>
      </div>
    `;
  }

  let body = '';
  for (const group of ROW_GROUPS) {
    const groupLabel = lang === 'en'
      ? group.header
      : `${group.header} (${group.header_zh})`;
    body += `<tr class="dt-group"><th colspan="${groupColspan}">${escapeHtml(groupLabel)}</th></tr>`;
    for (const row of group.rows) {
      const baseLabel = lang === 'en' ? row.spec : (row.spec_zh || row.spec);
      const badge = row.status && STATUS_BADGE[row.status]
        ? `<span class="dt-status dt-status-${row.status}" title="${escapeHtml(STATUS_BADGE[row.status][`title_${lang}`])}">${escapeHtml(STATUS_BADGE[row.status][lang])}</span>`
        : '';
      const label = `${escapeHtml(baseLabel)}${badge ? ' ' + badge : ''}`;
      let cells = '';
      for (let i = 0; i < bikes.length; i++) {
        const b = bikes[i];
        const out = outs[i];
        if (row.literal != null) {
          cells += literalCell(row.literal);
        } else if (row.component) {
          cells += componentCell(i, row.component, b.components?.[row.component], lang);
        } else if (row.input) {
          const has = readyByBike[i].has(row.input);
          if (CHASSIS_PROVIDED.has(row.input)) {
            // Chassis-domain fields are defined ONLY on the Chassis Setup
            // page. The table echoes the selected profile read-only — an
            // editable cell here would let a column silently diverge from
            // the chassis it claims to use.
            cells += has
              ? readonlyCell(fmtNum(effVals[i][row.input]))
              : blankCellHTML([row.input]);
          } else {
            // Show the value only when it's been actually set; otherwise
            // leave the cell blank and let the user fill it in. A tooltip
            // hints at where the value would normally come from.
            const v = has ? effVals[i][row.input] : null;
            cells += inputCell(i, row.input, v, has ? null : inputMissingTitle(row.input));
          }
        } else if (row.derivedFrom) {
          const st = cellStatus(row, readyByBike[i]);
          cells += st.ready
            ? readonlyCell(fmtNum(row.derivedFrom(out)))
            : blankCellHTML(st.missing);
        } else if (row.computed) {
          const st = cellStatus(row, readyByBike[i]);
          cells += st.ready
            ? readonlyCell(fmtNum(out[row.computed]))
            : blankCellHTML(st.missing);
        } else {
          cells += readonlyCell(DASH);
        }
      }
      body += `<tr><th class="dt-spec">${label}</th>${cells}</tr>`;
    }
  }

  return `
    <div class="dt-wrap">
      <table class="dt dt-compact">
        <thead>
          <tr>
            <th class="dt-spec">${escapeHtml(specHeader)}</th>
            ${bikeHeaders}
            ${addHeader}
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `;
}
