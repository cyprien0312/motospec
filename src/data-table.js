// ============================================================
// MotoSPEC Data Table view — editable per-bike profiles
// Mirrors motospec-style-table.csv structure
// ============================================================

import { computeAll, INPUT_META, defaultValues } from './formulas.js';
import { REFERENCE_BIKES } from './reference-bikes.js';
import { CATALOGS } from './catalog.js';

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
    { spec: 'Clamp/Yoke',                                           spec_zh: '三星台',               component: 'clamp' },
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移量 (mm)',    input: 'Yoke_Offset' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position', status: 'pending' },
    { spec: 'Fork',                                                 spec_zh: '前叉',                 component: 'fork' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '前叉弹簧刚度 (N/mm)',  input: 'Front_Spring_Rate', status: 'pending' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '前叉弹簧预压 (mm)',    input: 'Front_Spring_Preload', status: 'pending' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '前叉油位 (mm)',        input: 'Front_Oil_Level', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '前叉回顶弹簧刚度 (N/mm)', input: 'Front_Topout_Rate', status: 'pending' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '前叉回顶弹簧长度 (mm)', input: 'Front_Topout_Length', status: 'pending' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm',                                             spec_zh: '摇臂',                 component: 'swingarm' },
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '后避震Clevis调整 (mm)', input: 'Shock_Clevis_RHA' },
    { spec: 'Shock',                                                spec_zh: '避震',                 component: 'shock' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '后避震长度 (mm)',      input: 'Shock_Length', status: 'pending' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '后避震弹簧刚度 (N/mm)', input: 'Rear_Spring_Rate', status: 'pending' },
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
    { spec: 'Rake (degrees)',                                       spec_zh: '动态后倾角 (度)',     computed: 'MotoSPEC_Rake' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '动态拖曳距 (mm)',     computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Wheel Vertical Travel (mm)',                      spec_zh: '后轮垂直行程 (mm)',   computed: 'Rear_Wheel_Vertical_Travel', status: 'coords' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height',           status: 'coords' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角度 (度)',       computed: 'Swingarm_Angle',        status: 'coords' },
    { spec: 'Anti-Squat (%)',                                       spec_zh: '抗蹲百分比 (%)',      computed: 'Anti_Squat',                  status: 'coords' },
    { spec: 'Progression (% Full Shock Travel)',                    spec_zh: '渐进性 (%)',          computed: 'Progression',                status: 'coords' },
    { spec: 'Motion Ratio (Wheel/Shock)',                           spec_zh: '运动比 (轮/避震)',    computed: 'Motion_Ratio',               status: 'coords' },
    { spec: 'Wheelbase (mm)',                                       spec_zh: '轴距 (mm)',           computed: 'WB',                         status: 'static' },
    { spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate' },
    { spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate',            status: 'coords' },
    { spec: 'Front Wheel Force (N)',                                spec_zh: '前轮垂直载荷 (N)',    computed: 'MotoSPEC_FrontForce' },
    { spec: 'Rear Wheel Force (N)',                                 spec_zh: '后轮垂直载荷 (N)',    computed: 'MotoSPEC_RearForce' },
    { spec: 'CofG % Front',                                         spec_zh: '重心前侧占比 (%)',    derivedFrom: v => v.front_weight_dist * 100, status: 'static' },
    { spec: 'CofG % Rear',                                          spec_zh: '重心后侧占比 (%)',    derivedFrom: v => v.rear_weight_dist * 100,  status: 'static' },
  ]},
];

const STATUS_BADGE = {
  pending: { en: 'PENDING',  zh: '待实现',     title_en: 'Formula not yet implemented (Phase D research)', title_zh: '公式尚未实现（待 Phase D 研究）' },
  coords:  { en: 'NEEDS COORDS', zh: '需真实坐标', title_en: 'Real linkage formula, but the linkage coordinates default to placeholders — measured values needed for accuracy',  title_zh: '公式正确，但 linkage 坐标默认是占位值；需要实测坐标才能准确' },
  static:  { en: 'STATIC',   zh: '静态值',     title_en: 'Echoes the static input value verbatim — does not respond to dynamic compression/load', title_zh: '直接回显静态输入值，不随动态压缩/载荷变化' },
  partial: { en: 'PARTIAL',  zh: '部分实算',   title_en: 'Real formula, but some inputs (e.g. a_x, V, Cd, weight distribution) are not exposed in the data table and use hidden defaults', title_zh: '公式真实，但部分输入（如 a_x、V、Cd、重量分配）未在表格中暴露，使用隐藏默认值' },
  approx:  { en: 'APPROX',   zh: '简化近似',   title_en: 'Simplified approximation that bypasses the full linkage/driveline geometry — may disagree with the linkage-based results', title_zh: '简化近似，未走完整 linkage / 传动几何 — 可能与基于 linkage 的结果不一致' },
};

const DASH = '—';

// All linkage XY coords (used to detect when a bike is sitting on the
// INPUT_META placeholder defaults).
const LINKAGE_COORD_KEYS = [
  'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X',    'Rocker_To_Shock_Y',
  'Rocker_To_Drag_X',     'Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X',   'Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X',    'Frame_Shock_Top_Y',
];

// True when this bike's effective linkage coords are still placeholders —
// either (a) the chosen linkage catalog entry self-declares its source as
// PLACEHOLDER, or (b) no linkage is bound and the coords match
// defaultValues() exactly. The 'coords' badge on RESULTS rows is rendered
// per-cell based on this flag.
export function bikeUsesPlaceholderLinkage(bike) {
  const lid = bike?.components?.linkage;
  if (lid) {
    const entry = (CATALOGS.linkages || {})[lid];
    if (entry && /placeholder/i.test(entry.source || '')) return true;
    if (entry) return false;
  }
  const defaults = defaultValues();
  for (const k of LINKAGE_COORD_KEYS) {
    if ((bike?.values?.[k]) !== defaults[k]) return false;
  }
  return true;
}

// component bike-key → catalog name
export const COMPONENT_TO_CATALOG = {
  chassis: 'chassis',
  clamp: 'clamps',
  fork: 'forks',
  shock: 'shocks',
  swingarm: 'swingarms',
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
  };
}

function inputCell(bikeIdx, key, value) {
  const m = INPUT_META[key] || {};
  const step = m.step != null ? m.step : 'any';
  const minAttr = m.min != null ? ` min="${m.min}"` : '';
  const maxAttr = m.max != null ? ` max="${m.max}"` : '';
  const v = value == null || !Number.isFinite(value) ? '' : value;
  return `<td><input type="number" class="dt-input" value="${v}" step="${step}"${minAttr}${maxAttr} oninput="setBikeInput(${bikeIdx}, '${key}', this.value)"></td>`;
}

function componentCell(bikeIdx, componentKey, currentId) {
  const entries = catalogEntriesFor(componentKey);
  const optionsHtml = entries.map(([id, entry]) => {
    const sel = id === currentId ? ' selected' : '';
    const label = entry.name || id;
    return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(label)}</option>`;
  }).join('');
  return `<td><select class="dt-input" onchange="setBikeComponent(${bikeIdx}, '${componentKey}', this.value)">${optionsHtml}</select></td>`;
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

  const outs = bikes.map(b => computeAll({ ...b.values }));
  // Per-bike "coords are still placeholders" flag — drives per-cell badges
  // on RESULTS rows whose status === 'coords'.
  const placeholderByBike = bikes.map(bikeUsesPlaceholderLinkage);

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
      // 'coords' is now a per-cell badge (only on bikes whose linkage is
      // still a placeholder), so suppress it from the row label.
      const showRowBadge = row.status && STATUS_BADGE[row.status] && row.status !== 'coords';
      const badge = showRowBadge
        ? `<span class="dt-status dt-status-${row.status}" title="${escapeHtml(STATUS_BADGE[row.status][`title_${lang}`])}">${escapeHtml(STATUS_BADGE[row.status][lang])}</span>`
        : '';
      const label = `${escapeHtml(baseLabel)}${badge ? ' ' + badge : ''}`;
      let cells = '';
      for (let i = 0; i < bikes.length; i++) {
        const b = bikes[i];
        const out = outs[i];
        // Per-cell badge: a 'coords' status row marks only the bikes whose
        // effective linkage is still on placeholder coords. Real coords →
        // no badge, the number is trustworthy.
        const cellPlaceholder = row.status === 'coords' && placeholderByBike[i];
        const cellBadge = cellPlaceholder
          ? ` <span class="dt-status dt-status-coords" title="${escapeHtml(STATUS_BADGE.coords[`title_${lang}`])}">${escapeHtml(STATUS_BADGE.coords[lang])}</span>`
          : '';
        if (row.literal != null) {
          cells += literalCell(row.literal);
        } else if (row.component) {
          cells += componentCell(i, row.component, b.components?.[row.component]);
        } else if (row.input) {
          cells += inputCell(i, row.input, b.values?.[row.input]);
        } else if (row.derivedFrom) {
          cells += `<td class="dt-readonly"><span>${escapeHtml(fmtNum(row.derivedFrom(out)))}</span>${cellBadge}</td>`;
        } else if (row.computed) {
          cells += `<td class="dt-readonly"><span>${escapeHtml(fmtNum(out[row.computed]))}</span>${cellBadge}</td>`;
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
