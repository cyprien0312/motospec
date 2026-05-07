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
    { spec: 'Front Weight Distribution',                            spec_zh: '前轮静态重量分配',    input: 'front_weight_dist' },
    { spec: 'Rear Weight Distribution',                             spec_zh: '后轮静态重量分配',    input: 'rear_weight_dist' },
    { spec: 'Front Aero Downforce Share',                           spec_zh: '前轮气动下压力分配',  input: 'C_f_aero' },
    { spec: 'Rear Aero Downforce Share',                            spec_zh: '后轮气动下压力分配',  input: 'C_r_aero' },
  ]},
  { header: 'FRONT SETTINGS', header_zh: '前部设置', rows: [
    { spec: 'Clamp/Yoke',                                           spec_zh: '三星台',               component: 'clamp' },
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移 (mm)',      input: 'Yoke_Offset' },
    { spec: 'Steering Axis Angle (degrees)',                        spec_zh: '转向轴角 (度)',        literal: '0.00 deg' },
    { spec: 'Total Steering Offset (mm)',                           spec_zh: '总偏移量 O (mm)',      computed: 'O' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position', status: 'pending' },
    { spec: 'Fork',                                                 spec_zh: '前叉',                 component: 'fork' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Front_Spring_Rate', status: 'pending' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Front_Spring_Preload', status: 'pending' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '油位 (mm)',            input: 'Front_Oil_Level', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Front_Topout_Rate', status: 'pending' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Front_Topout_Length', status: 'pending' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm',                                             spec_zh: '摇臂',                 component: 'swingarm' },
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '避震Clevis车高 (mm)',  input: 'Shock_Clevis_RHA' },
    { spec: 'Shock',                                                spec_zh: '避震',                 component: 'shock' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '避震长度 (mm)',        input: 'Shock_Length', status: 'pending' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Rear_Spring_Rate', status: 'pending' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Rear_Spring_Preload', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Rear_Topout_Rate', status: 'pending' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Rear_Topout_Length', status: 'pending' },
    { spec: 'Linkage',                                              spec_zh: '连杆',                 component: 'linkage' },
  ]},
  { header: 'SPROCKETS', header_zh: '链轮', rows: [
    { spec: 'Front Sprocket',                                       spec_zh: '前链轮',              input: 'Front_Sprocket' },
    { spec: 'Rear Sprocket',                                        spec_zh: '后链轮',              input: 'Rear_Sprocket' },
    { spec: 'Final Ratio',                                          spec_zh: '最终传动比',          computed: 'Final_Ratio' },
  ]},
  { header: 'DYNAMIC READINGS', header_zh: '动态读数', rows: [
    { spec: 'Preset',                                               spec_zh: '动态预设',            preset: true },
    { spec: 'Front Potentiometer (mm)',                             spec_zh: '前电位计 (mm)',       input: 'Travel_Front' },
    { spec: 'Rear Potentiometer (mm)',                              spec_zh: '后电位计 (mm)',       input: 'Travel_Rear' },
    { spec: 'Lean Angle (degrees)',                                 spec_zh: '倾角 (度)',           input: 'Lean_Angle', status: 'pending' },
  ]},
  { header: 'DYNAMIC LOAD', header_zh: '动态载荷', rows: [
    { spec: 'Longitudinal Acceleration (g)',                        spec_zh: '纵向加速度 (g)',      input: 'a_x' },
    { spec: 'Velocity (m/s)',                                       spec_zh: '实时车速 (m/s)',      input: 'V' },
    { spec: 'Drag Coefficient',                                     spec_zh: '阻力系数',            input: 'Cd' },
    { spec: 'Frontal Area (m²)',                                    spec_zh: '迎风面积 (m²)',       input: 'A' },
  ]},
  { header: 'RESULTS', header_zh: '结果', rows: [
    { spec: 'Rake (degrees)',                                       spec_zh: '后倾角 (度)',         computed: 'MotoSPEC_Rake' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '拖曳距 (mm)',         computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Wheel Vertical Travel (mm)',                      spec_zh: '后轮垂直行程 (mm)',   computed: 'Rear_Wheel_Vertical_Travel', status: 'coords' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height',           status: 'coords' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角 (度)',         computed: 'MotoSPEC_SwgarmAngl',        status: 'coords' },
    { spec: 'AntiSquat (%)',                                        spec_zh: '抗蹲伏 (%)',          computed: 'MotoSPEC_AntSquat',          status: 'coords' },
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

// component bike-key → catalog name
export const COMPONENT_TO_CATALOG = {
  clamp: 'clamps',
  fork: 'forks',
  shock: 'shocks',
  swingarm: 'swingarms',
  linkage: 'linkages',
};

// All component keys appearing on bike rows (for tests / introspection).
export const COMPONENT_FIELDS = Object.keys(COMPONENT_TO_CATALOG);

// Convention (per formulas.js a_x desc): braking is POSITIVE, accel is NEGATIVE.
const DYNAMIC_LOAD_PRESETS = {
  sag:        { a_x: 0,    V: 0,  Cd: 0.4, A: 0.45 },
  braking:    { a_x: 1.0,  V: 25, Cd: 0.4, A: 0.45 },
  mid_corner: { a_x: 0,    V: 20, Cd: 0.4, A: 0.45 },
};

export const PRESET_VALUES = {
  sag:        { Travel_Front: 30,  Travel_Rear: 10, Lean_Angle: 0,  ...DYNAMIC_LOAD_PRESETS.sag },
  braking:    { Travel_Front: 120, Travel_Rear: 2,  Lean_Angle: 0,  ...DYNAMIC_LOAD_PRESETS.braking },
  mid_corner: { Travel_Front: 80,  Travel_Rear: 20, Lean_Angle: 55, ...DYNAMIC_LOAD_PRESETS.mid_corner },
};

const PRESET_LABELS = {
  en: { sag: 'Sag', braking: 'Braking', mid_corner: 'Mid-Corner', custom: 'Custom' },
  zh: { sag: '静态下沉', braking: '刹车', mid_corner: '弯中', custom: '自定义' },
};

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

export function defaultBikes() {
  const presetByIndex = ['sag', 'braking', 'mid_corner'];
  return REFERENCE_BIKES.map((b, i) => {
    const baseValues = defaultValues();
    const values = { ...baseValues, ...(b.inputs || {}) };
    const presetName = presetByIndex[i] || 'sag';
    Object.assign(values, PRESET_VALUES[presetName]);
    return {
      id: `col-${i}`,
      name: b.name,
      values,
      components: { ...(b.components || {}) },
      preset: presetName,
    };
  });
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

function presetCell(bikeIdx, current, lang) {
  const labels = PRESET_LABELS[lang] || PRESET_LABELS.en;
  const opts = ['sag', 'braking', 'mid_corner', 'custom'];
  const optionsHtml = opts.map(p => {
    const sel = p === current ? ' selected' : '';
    return `<option value="${p}"${sel}>${escapeHtml(labels[p])}</option>`;
  }).join('');
  return `<td><select class="dt-input" onchange="applyBikePreset(${bikeIdx}, this.value)">${optionsHtml}</select></td>`;
}

function readonlyCell(value) {
  return `<td class="dt-readonly"><span>${escapeHtml(value)}</span></td>`;
}

function literalCell(text) {
  return `<td class="dt-readonly"><span>${escapeHtml(text)}</span></td>`;
}

export function renderDataTable(state) {
  const lang = state?.lang || 'zh';
  const bikes = (state && Array.isArray(state.bikes) && state.bikes.length === 3)
    ? state.bikes
    : defaultBikes();

  const outs = bikes.map(b => computeAll({ ...b.values }));

  const bikeHeaders = bikes.map((b, i) =>
    `<th><input type="text" class="dt-input dt-bike-name" value="${escapeHtml(b.name)}" onchange="setBikeName(${i}, this.value)"></th>`
  ).join('');
  const specHeader = lang === 'en' ? 'Parameter' : '参数';

  let body = '';
  for (const group of ROW_GROUPS) {
    const groupLabel = lang === 'en'
      ? group.header
      : `${group.header} (${group.header_zh})`;
    body += `<tr class="dt-group"><th colspan="4">${escapeHtml(groupLabel)}</th></tr>`;
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
        } else if (row.preset) {
          cells += presetCell(i, b.preset || 'custom', lang);
        } else if (row.component) {
          cells += componentCell(i, row.component, b.components?.[row.component]);
        } else if (row.input) {
          cells += inputCell(i, row.input, b.values?.[row.input]);
        } else if (row.derivedFrom) {
          cells += readonlyCell(fmtNum(row.derivedFrom(out)));
        } else if (row.computed) {
          cells += readonlyCell(fmtNum(out[row.computed]));
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
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `;
}
